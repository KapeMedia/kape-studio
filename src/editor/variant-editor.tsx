"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { AlignCenter, AlignLeft, AlignRight, Download, Eye, EyeOff, ImagePlus, RefreshCw, Redo2, Save, Trash2, Undo2 } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { DocumentCanvas, type DocumentCanvasHandle, type TextMetrics } from "./document-canvas";
import { OffscreenRenderer, uploadPreview, type OffscreenRendererHandle } from "./offscreen-renderer";
import { toFileUrl } from "./template-preview";
import { createHistory, push, redo, replace, undo, type History } from "./history";
import type { DocLayer, DocTextLayer, TemplateDefinition, VariantDocument } from "@/lib/template-types";
import type { SafeZone, VariantCopy } from "@/lib/types";
import type { Palette } from "@/lib/colors";
import { carryOverEdits, resolveDocument } from "@/lib/resolve";
import { normalizeDiacritics } from "@/lib/diacritics";
import { exportFileName } from "@/lib/export-names";
import { saveDocumentsAction, uploadVariantImageAction } from "@/app/actions/editor";
import { cn } from "@/lib/utils";

type Docs = Record<string, VariantDocument>;

export type EditorProps = {
  variantId: string;
  initialDocs: Docs;
  documentVersion: number;
  masterFormatKey: string;
  copy: VariantCopy;
  formats: { key: string; label: string; width: number; height: number; safeZone: SafeZone; enabled: boolean }[];
  template: { id: string; definition: TemplateDefinition } | null;
  brand: {
    palette: Palette;
    fonts: { heading: string; body: string };
    fontSources: { family: string; url: string }[];
    fontNames: { family: string; label: string }[];
    logo: string | null;
    logoLight: string | null;
    photos: { key: string; name: string }[];
    colors: { name: string; hex: string }[];
  };
  names: { client: string; project: string; style: string | null; index: number };
  sidebarExtra?: React.ReactNode;
};

const LAYER_LABEL: Record<string, string> = { image: "Imagine", overlay: "Overlay", shape: "Formă", logo: "Logo", text: "Text" };
const ROLE_LABEL: Record<string, string> = { headline: "Headline", subheadline: "Subheadline", cta: "CTA", price: "Preț", badge: "Badge", body: "Text" };

function layerName(l: DocLayer) {
  return l.type === "text" ? `${ROLE_LABEL[l.role] ?? "Text"}: ${l.text.slice(0, 24)}` : `${LAYER_LABEL[l.type]} (${l.id})`;
}

function ColorPicker({ value, onChange, colors }: { value: string; onChange: (hex: string) => void; colors: { name: string; hex: string }[] }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c.hex + c.name}
            type="button"
            title={`${c.name} ${c.hex}`}
            onClick={() => onChange(c.hex.toUpperCase())}
            className={cn("h-7 w-7 rounded-md border border-black/10", value.toUpperCase() === c.hex.toUpperCase() && "ring-2 ring-accent ring-offset-1")}
            style={{ background: c.hex }}
          />
        ))}
        <button type="button" title="Alb" onClick={() => onChange("#FFFFFF")} className="h-7 w-7 rounded-md border bg-white" />
        <button type="button" title="Negru" onClick={() => onChange("#000000")} className="h-7 w-7 rounded-md border bg-black" />
      </div>
      <div className="flex gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-8 w-10 rounded border p-0.5" aria-label="Culoare liberă" />
        <Input
          key={value}
          defaultValue={value}
          onBlur={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && onChange(e.target.value.toUpperCase())}
          className="h-8 font-mono"
          aria-label="Hex"
        />
      </div>
    </div>
  );
}

export function VariantEditor(props: EditorProps) {
  const { variantId, formats, template, brand, names } = props;
  const router = useRouter();
  const toast = useToast();
  const [hist, setHist] = useState<History<Docs>>(() => createHistory(props.initialDocs));
  const docs = hist.present;
  const [version, setVersion] = useState(props.documentVersion);
  const [formatKey, setFormatKey] = useState(props.masterFormatKey in props.initialDocs ? props.masterFormatKey : (Object.keys(props.initialDocs)[0] ?? props.masterFormatKey));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSafe, setShowSafe] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormats, setExportFormats] = useState<string[]>(Object.keys(props.initialDocs));
  const [inlineEdit, setInlineEdit] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TextMetrics>({});
  const [regenerating, setRegenerating] = useState(false);
  const canvasRef = useRef<DocumentCanvasHandle>(null);
  const offscreen = useRef<OffscreenRendererHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(600);
  const lastTypingLayer = useRef<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth));
    ro.observe(el);
    setWrapW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const format = formats.find((f) => f.key === formatKey);
  const doc = docs[formatKey];
  const displayWidth = doc ? Math.max(200, Math.min(wrapW - 32, (640 * doc.width) / doc.height)) : 400;
  const scale = doc ? displayWidth / doc.width : 1;
  const selected = doc?.layers.find((l) => l.id === selectedId) ?? null;

  const commit = useCallback((next: Docs, opts: { merge?: boolean } = {}) => {
    setHist((h) => (opts.merge ? replace(h, next) : push(h, next)));
    setDirty(true);
  }, []);

  const updateLayer = useCallback(
    (id: string, patch: Partial<DocLayer>, opts: { merge?: boolean; allFormats?: boolean } = {}) => {
      const apply = (d: VariantDocument): VariantDocument => ({ ...d, layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as DocLayer) : l)) });
      const next: Docs = { ...docs };
      if (opts.allFormats) for (const k of Object.keys(next)) next[k] = apply(next[k]!);
      else if (doc) next[formatKey] = apply(doc);
      commit(next, opts);
    },
    [docs, doc, formatKey, commit],
  );

  const typeText = (id: string, text: string) => {
    const merge = lastTypingLayer.current === id;
    lastTypingLayer.current = id;
    updateLayer(id, { text: normalizeDiacritics(text) } as Partial<DocLayer>, { merge });
  };
  const endTyping = () => {
    lastTypingLayer.current = null;
  };

  // keyboard: undo / redo / delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        setHist((h) => undo(h));
      } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        setHist((h) => redo(h));
      } else if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // warn on leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /** Format without a document → derive it from the template and carry over edits from the master. */
  const deriveFormat = useCallback(
    (key: string): VariantDocument | null => {
      const spec = formats.find((f) => f.key === key);
      const master = docs[props.masterFormatKey] ?? Object.values(docs)[0];
      if (!spec || !template || !master) return null;
      const bg = master.layers.find((l) => l.type === "image");
      const textOf = (role: string) => {
        const l = master.layers.find((x) => x.type === "text" && x.role === role);
        return l && l.type === "text" ? l.text : undefined;
      };
      const copy: VariantCopy = {
        headline: textOf("headline") ?? props.copy.headline,
        subheadline: textOf("subheadline") ?? props.copy.subheadline,
        cta: textOf("cta") ?? props.copy.cta,
        extra: { price: textOf("price") ?? props.copy.extra?.price, badge: textOf("badge") ?? props.copy.extra?.badge },
      };
      const fresh = resolveDocument({
        templateId: template.id,
        definition: template.definition,
        format: { key: spec.key, width: spec.width, height: spec.height, safeZone: spec.safeZone },
        copy,
        palette: brand.palette,
        fonts: brand.fonts,
        assets: { background: bg && bg.type === "image" ? bg.src : null, logo: brand.logo, logoLight: brand.logoLight },
      });
      return carryOverEdits(master, fresh);
    },
    [docs, formats, template, brand, props.masterFormatKey, props.copy],
  );

  const switchFormat = (key: string) => {
    setSelectedId(null);
    setInlineEdit(null);
    if (!docs[key]) {
      const d = deriveFormat(key);
      if (!d) return toast({ title: "Nu pot deriva formatul (stilul nu mai există).", tone: "error" });
      commit({ ...docs, [key]: d });
      setExportFormats((p) => Array.from(new Set([...p, key])));
    }
    setFormatKey(key);
  };

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const r = await saveDocumentsAction(variantId, docs, version);
      if (!r.ok) {
        toast({ title: "Nu am putut salva", description: r.error, tone: "error" });
        return false;
      }
      setVersion(r.data!.version);
      setDirty(false);
      const master = docs[props.masterFormatKey];
      if (master && offscreen.current) {
        try {
          const rendered = await offscreen.current.render(master);
          await uploadPreview(variantId, rendered, props.masterFormatKey);
        } catch (e) {
          console.warn("[editor] preview upload failed", e);
        }
      }
      toast({ title: `Salvat (versiunea ${r.data!.version})`, tone: "success" });
      router.refresh();
      return true;
    } finally {
      setSaving(false);
    }
  };

  const exportZip = async (keys: string[]) => {
    if (!offscreen.current) return;
    setExporting(true);
    try {
      const all: Docs = { ...docs };
      for (const k of keys) if (!all[k]) all[k] = deriveFormat(k)!;
      const zip = new JSZip();
      const files: { name: string; blob: Blob }[] = [];
      for (const k of keys) {
        const d = all[k];
        if (!d) continue;
        const r = await offscreen.current.render(d);
        files.push({ name: exportFileName({ ...names, format: k }), blob: r.blob });
      }
      if (files.length === 1) {
        triggerDownload(files[0]!.blob, files[0]!.name);
      } else {
        for (const f of files) zip.file(f.name, f.blob);
        const blob = await zip.generateAsync({ type: "blob" });
        triggerDownload(blob, exportFileName({ ...names, format: "toate" }).replace(/\.png$/, ".zip"));
      }
    } catch (e) {
      toast({ title: "Export eșuat", description: e instanceof Error ? e.message : "", tone: "error" });
    } finally {
      setExporting(false);
    }
  };

  const setBackground = (key: string) => {
    const next: Docs = {};
    for (const [k, d] of Object.entries(docs)) next[k] = { ...d, layers: d.layers.map((l) => (l.type === "image" ? { ...l, src: key } : l)) };
    commit(next);
  };

  const uploadImage = async (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    const r = await uploadVariantImageAction(variantId, fd);
    if (r.ok && r.data) setBackground(r.data.key);
    else if (!r.ok) toast({ title: "Upload eșuat", description: r.error, tone: "error" });
  };

  const regenerateImage = async () => {
    if (dirty && !(await save())) return;
    setRegenerating(true);
    const res = await fetch(`/api/variants/${variantId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "regenerate_image", keepDocuments: true }) });
    if (!res.ok) {
      setRegenerating(false);
      return toast({ title: "Nu am putut porni regenerarea", tone: "error" });
    }
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const v = (await (await fetch(`/api/variants/${variantId}`)).json()) as { variant?: { status: string; documents: Docs; documentVersion: number; error: string | null } };
      if (v.variant && v.variant.status !== "pending") {
        setRegenerating(false);
        if (v.variant.status === "failed") return toast({ title: "Regenerarea a eșuat", description: v.variant.error ?? "", tone: "error" });
        setHist(createHistory(v.variant.documents));
        setVersion(v.variant.documentVersion);
        setDirty(false);
        toast({ title: "Imagine nouă generată", tone: "success" });
        const master = v.variant.documents[props.masterFormatKey];
        if (master && offscreen.current) await uploadPreview(variantId, await offscreen.current.render(master), props.masterFormatKey);
        router.refresh();
        return;
      }
    }
    setRegenerating(false);
  };

  const deleteLayer = (id: string) => {
    if (!doc) return;
    commit({ ...docs, [formatKey]: { ...doc, layers: doc.layers.filter((l) => l.id !== id) } });
    setSelectedId(null);
  };

  const inlineLayer = inlineEdit && doc ? (doc.layers.find((l) => l.id === inlineEdit) as DocTextLayer | undefined) : undefined;
  const fileInput = useRef<HTMLInputElement>(null);
  const overflowIds = useMemo(() => Object.entries(metrics).filter(([, m]) => m.overflow).map(([id]) => id), [metrics]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg border bg-white p-1">
            {formats
              .filter((f) => f.enabled || docs[f.key])
              .map((f) => (
                <button
                  key={f.key}
                  onClick={() => switchFormat(f.key)}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium", f.key === formatKey ? "bg-accent text-white" : docs[f.key] ? "text-gray-800 hover:bg-gray-100" : "text-gray-400 hover:bg-gray-100")}
                  title={docs[f.key] ? f.label : `${f.label}: se derivă automat`}
                >
                  {f.label.replace(" (master)", "")}
                </button>
              ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" title="Anulează (Ctrl+Z)" disabled={!hist.past.length} onClick={() => setHist((h) => undo(h))}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Refă (Ctrl+Y)" disabled={!hist.future.length} onClick={() => setHist((h) => redo(h))}>
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowSafe((s) => !s)} title="Safe zone">
              {showSafe ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Safe zone
            </Button>
            <Button size="sm" onClick={() => void save()} loading={saving} disabled={!dirty && !saving}>
              <Save className="h-4 w-4" /> Salvează
            </Button>
          </div>
        </div>
        <div ref={wrapRef} className="checkerboard relative flex min-h-[400px] items-start justify-center rounded-lg border p-4">
          {doc ? (
            <div className="relative shadow-md">
              <DocumentCanvas
                ref={canvasRef}
                doc={doc}
                displayWidth={displayWidth}
                fonts={brand.fontSources}
                fileUrl={toFileUrl}
                placeholder={[brand.palette.secondary, brand.palette.primary]}
                safeZone={format?.safeZone}
                showSafeZone={showSafe}
                editable
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  if (id !== inlineEdit) setInlineEdit(null);
                }}
                onLayerChange={(id, patch) => updateLayer(id, patch)}
                onTextDblClick={(id) => {
                  setSelectedId(id);
                  setInlineEdit(id);
                }}
                onMetrics={setMetrics}
              />
              {inlineLayer && (
                <textarea
                  autoFocus
                  value={inlineLayer.text}
                  onChange={(e) => typeText(inlineLayer.id, e.target.value)}
                  onBlur={() => {
                    endTyping();
                    setInlineEdit(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
                      endTyping();
                      setInlineEdit(null);
                    }
                  }}
                  className="absolute resize-none rounded border-2 border-accent bg-white/95 p-1 text-sm shadow"
                  style={{ left: inlineLayer.x * scale, top: inlineLayer.y * scale, width: Math.max(160, inlineLayer.w * scale), height: Math.max(60, inlineLayer.h * scale) }}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Nu există document pentru acest format.</p>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">
          Click pe un element ca să-l selectezi, trage ca să-l muți, folosește colțurile ca să-l redimensionezi. Dublu-click pe text ca să-l editezi. Ctrl+Z / Ctrl+Y.
          {overflowIds.length > 0 && <span className="ml-1 text-red-600">Atenție: {overflowIds.length} text(e) nu încap.</span>}
        </p>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border bg-white p-3">
          <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Layere</div>
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {doc?.layers
              .slice()
              .reverse()
              .map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={cn("flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs", l.id === selectedId ? "bg-accent-soft text-accent" : "hover:bg-gray-50")}
                >
                  <span className="truncate">{layerName(l)}</span>
                  {overflowIds.includes(l.id) && <Badge tone="red">nu încape</Badge>}
                </button>
              ))}
          </div>
        </div>

        {selected && (
          <div className="space-y-3 rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{layerName(selected)}</span>
              <Button variant="ghost" size="icon" title="Șterge layerul" onClick={() => deleteLayer(selected.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {selected.type === "text" && (
              <>
                <Field label="Text">
                  <Textarea value={selected.text} onChange={(e) => typeText(selected.id, e.target.value)} onBlur={endTyping} className="min-h-16" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Font">
                    <Select
                      value={selected.fontFamily}
                      onValueChange={(v) => updateLayer(selected.id, { fontFamily: v } as Partial<DocLayer>)}
                      options={[...brand.fontNames.map((f) => ({ value: f.family, label: f.label })), { value: "Inter", label: "Inter (implicit)" }].filter((o, i, a) => a.findIndex((x) => x.value === o.value) === i)}
                    />
                  </Field>
                  <Field label="Grosime">
                    <Select
                      value={String(selected.weight)}
                      onValueChange={(v) => updateLayer(selected.id, { weight: Number(v) } as Partial<DocLayer>)}
                      options={[300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }))}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Mărime (px)">
                    <Input
                      type="number"
                      value={Math.round(metrics[selected.id]?.fontSize ?? selected.fontSize)}
                      onChange={(e) => {
                        const n = Math.max(8, Number(e.target.value) || 8);
                        updateLayer(selected.id, { fontSize: n, autoFit: false, maxSize: Math.max(selected.maxSize, n), minSize: Math.min(selected.minSize, n) } as Partial<DocLayer>);
                      }}
                    />
                  </Field>
                  <div className="flex items-end pb-2">
                    <Checkbox checked={selected.autoFit} onChange={(c) => updateLayer(selected.id, { autoFit: c, fontSize: Math.round(metrics[selected.id]?.fontSize ?? selected.fontSize) } as Partial<DocLayer>)} label="Încadrare automată" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <Button key={a} size="icon" variant={selected.align === a ? "secondary" : "ghost"} onClick={() => updateLayer(selected.id, { align: a } as Partial<DocLayer>)} title={a}>
                      {a === "left" ? <AlignLeft className="h-4 w-4" /> : a === "center" ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
                    </Button>
                  ))}
                  <div className="ml-2">
                    <Checkbox checked={selected.uppercase} onChange={(c) => updateLayer(selected.id, { uppercase: c } as Partial<DocLayer>)} label="MAJUSCULE" />
                  </div>
                </div>
                <Field label="Culoare text">
                  <ColorPicker value={selected.color} onChange={(hex) => updateLayer(selected.id, { color: hex } as Partial<DocLayer>)} colors={brand.colors} />
                </Field>
                {selected.background && (
                  <Field label="Culoare fundal (buton/badge)">
                    <ColorPicker value={selected.background.fill} onChange={(hex) => updateLayer(selected.id, { background: { ...selected.background!, fill: hex } } as Partial<DocLayer>)} colors={brand.colors} />
                  </Field>
                )}
              </>
            )}

            {(selected.type === "shape" || selected.type === "overlay") && (
              <>
                <Field label="Culoare">
                  <ColorPicker value={selected.fill} onChange={(hex) => updateLayer(selected.id, { fill: hex } as Partial<DocLayer>)} colors={brand.colors} />
                </Field>
                {selected.type === "overlay" && (
                  <Field label={`Opacitate ${Math.round(selected.opacity * 100)}%`}>
                    <input type="range" min={0} max={1} step={0.05} value={selected.opacity} onChange={(e) => updateLayer(selected.id, { opacity: Number(e.target.value) } as Partial<DocLayer>)} className="w-full" />
                  </Field>
                )}
              </>
            )}

            {selected.type === "logo" && (
              <Field label="Variantă logo">
                <Select
                  value={selected.src === brand.logoLight ? "light" : "default"}
                  onValueChange={(v) => updateLayer(selected.id, { src: v === "light" ? (brand.logoLight ?? brand.logo) : (brand.logo ?? brand.logoLight) } as Partial<DocLayer>)}
                  options={[
                    { value: "default", label: "Logo principal" },
                    { value: "light", label: "Logo pentru fundal închis" },
                  ]}
                />
              </Field>
            )}

            {selected.type === "image" && (
              <div className="space-y-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadImage(f);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                    <ImagePlus className="h-3.5 w-3.5" /> Încarcă
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void regenerateImage()} loading={regenerating}>
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerează
                  </Button>
                </div>
                {brand.photos.length > 0 && (
                  <>
                    <div className="text-xs text-muted">Din brand kit:</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {brand.photos.map((p) => (
                        <button key={p.key} title={p.name} onClick={() => setBackground(p.key)} className={cn("aspect-square overflow-hidden rounded border-2", selected.src === p.key ? "border-accent" : "border-transparent")}>
                          <img src={toFileUrl(p.key)} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <Field label="Încadrare">
                  <Select value={selected.fit} onValueChange={(v) => updateLayer(selected.id, { fit: v as "cover" | "contain" } as Partial<DocLayer>)} options={[{ value: "cover", label: "Umple (cover)" }, { value: "contain", label: "Încape (contain)" }]} />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-4 gap-1.5">
              {(["x", "y", "w", "h"] as const).map((k) => (
                <label key={k} className="text-[11px] text-muted">
                  {k.toUpperCase()}
                  <Input type="number" className="h-7 px-1.5 text-xs" value={Math.round(selected[k])} onChange={(e) => updateLayer(selected.id, { [k]: Number(e.target.value) || 0 } as Partial<DocLayer>)} />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-lg border bg-white p-3">
          <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Export</div>
          <div className="grid grid-cols-1 gap-1">
            {formats
              .filter((f) => f.enabled || docs[f.key])
              .map((f) => (
                <Checkbox key={f.key} checked={exportFormats.includes(f.key)} onChange={(c) => setExportFormats((p) => (c ? [...p, f.key] : p.filter((x) => x !== f.key)))} label={`${f.label}${docs[f.key] ? "" : " (derivat)"}`} />
              ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" loading={exporting} disabled={!exportFormats.length} onClick={() => void exportZip(exportFormats)}>
              <Download className="h-3.5 w-3.5" /> {exportFormats.length > 1 ? "Export ZIP" : "Export PNG"}
            </Button>
            <Button size="sm" variant="outline" loading={exporting} onClick={() => void exportZip([formatKey])} title="Doar formatul curent">
              PNG curent
            </Button>
          </div>
          {dirty && <p className="text-xs text-amber-700">Ai modificări nesalvate (exportul folosește ce vezi acum).</p>}
        </div>
        {props.sidebarExtra}
      </aside>
      <OffscreenRenderer ref={offscreen} fonts={brand.fontSources} />
    </div>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
