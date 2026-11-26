"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { archiveStyleAction, publishStyleVersionAction, saveStyleAction, uploadStyleReferenceAction } from "@/app/actions/library";
import { TemplatePreviewLazy } from "@/editor/lazy";
import { toFileUrl, type BrandView } from "@/editor/template-preview";
import type { FormatSpec } from "@/lib/derive";
import type { TemplateDefinition } from "@/lib/template-types";
import { formatDateTime } from "@/lib/utils";

type VersionView = {
  id: string;
  version: number;
  templateId: string;
  visualPrompt: string;
  avoid: string;
  copyGuidance: string;
  referenceAssetKeys: string[];
  textMode: "overlay" | "full_ai";
  changelog: string;
  createdAt: string;
};

export function StyleForm({
  style,
  versions,
  currentVersionId,
  templates,
  brand,
  specs,
}: {
  style: { id: string; name: string; description: string; whenToUse: string; archived: boolean } | null;
  versions: VersionView[];
  currentVersionId: string | null;
  templates: { id: string; name: string; definition: TemplateDefinition }[];
  brand: BrandView;
  specs: FormatSpec[];
}) {
  const base = versions.find((v) => v.id === currentVersionId) ?? versions[0];
  const [meta, setMeta] = useState({ name: style?.name ?? "", description: style?.description ?? "", whenToUse: style?.whenToUse ?? "" });
  const [ver, setVer] = useState({
    templateId: base?.templateId ?? templates[0]?.id ?? "",
    visualPrompt: base?.visualPrompt ?? "",
    avoid: base?.avoid ?? "",
    copyGuidance: base?.copyGuidance ?? "",
    referenceAssetKeys: base?.referenceAssetKeys ?? [],
    textMode: base?.textMode ?? ("overlay" as const),
    changelog: "",
  });
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const definition = useMemo(() => templates.find((t) => t.id === ver.templateId)?.definition ?? null, [templates, ver.templateId]);

  const loadVersion = (v: VersionView) =>
    setVer({ templateId: v.templateId, visualPrompt: v.visualPrompt, avoid: v.avoid, copyGuidance: v.copyGuidance, referenceAssetKeys: v.referenceAssetKeys, textMode: v.textMode, changelog: "" });

  const save = () =>
    start(async () => {
      const r = await saveStyleAction(style?.id ?? null, meta, ver);
      if (!r.ok) return toast({ title: "Nu am putut salva", description: r.error, tone: "error" });
      toast({ title: style ? "Versiune nouă salvată (nepublicată)" : "Stil creat", tone: "success" });
      if (!style && r.data) router.push(`/library/styles/${r.data.styleId}`);
      else router.refresh();
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nume">
                <Input value={meta.name} onChange={(e) => setMeta((p) => ({ ...p, name: e.target.value }))} />
              </Field>
              <Field label="Template">
                <Select value={ver.templateId} onValueChange={(v) => setVer((p) => ({ ...p, templateId: v }))} options={templates.map((t) => ({ value: t.id, label: t.name }))} />
              </Field>
            </div>
            <Field label="Descriere">
              <Textarea value={meta.description} onChange={(e) => setMeta((p) => ({ ...p, description: e.target.value }))} />
            </Field>
            <Field label="Când se folosește">
              <Input value={meta.whenToUse} onChange={(e) => setMeta((p) => ({ ...p, whenToUse: e.target.value }))} />
            </Field>
            <Field label="Prompt vizual (engleză, descrie DOAR imaginea)">
              <Textarea value={ver.visualPrompt} onChange={(e) => setVer((p) => ({ ...p, visualPrompt: e.target.value }))} className="min-h-28" />
            </Field>
            <Field label="Ce să evite">
              <Textarea value={ver.avoid} onChange={(e) => setVer((p) => ({ ...p, avoid: e.target.value }))} />
            </Field>
            <Field label="Ghid de copy (lungime headline, ton)">
              <Textarea value={ver.copyGuidance} onChange={(e) => setVer((p) => ({ ...p, copyGuidance: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Mod text" hint="full_ai: textul e generat în imagine (doar pentru cazuri speciale).">
                <Select
                  value={ver.textMode}
                  onValueChange={(v) => setVer((p) => ({ ...p, textMode: v as "overlay" | "full_ai" }))}
                  options={[
                    { value: "overlay", label: "overlay (textul îl pune template-ul)" },
                    { value: "full_ai", label: "full_ai (text în imagine)" },
                  ]}
                />
              </Field>
              <Field label="Ce s-a schimbat (changelog)">
                <Input value={ver.changelog} onChange={(e) => setVer((p) => ({ ...p, changelog: e.target.value }))} placeholder="ex: prompt mai luminos" />
              </Field>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Imagini de referință ale stilului</span>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    const fd = new FormData();
                    for (const f of Array.from(files)) fd.append("files", f);
                    e.target.value = "";
                    start(async () => {
                      const r = await uploadStyleReferenceAction(fd);
                      if (r.ok && r.data) setVer((p) => ({ ...p, referenceAssetKeys: [...p.referenceAssetKeys, ...r.data!.keys].slice(0, 8) }));
                      else if (!r.ok) toast({ title: "Upload eșuat", description: r.error, tone: "error" });
                    });
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <ImagePlus className="h-3.5 w-3.5" /> Adaugă
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {ver.referenceAssetKeys.map((k) => (
                  <div key={k} className="group relative h-20 w-20 overflow-hidden rounded border">
                    <img src={toFileUrl(k)} alt="" className="h-full w-full object-cover" />
                    <button className="absolute top-0.5 right-0.5 rounded bg-white/90 p-0.5 opacity-0 group-hover:opacity-100" onClick={() => setVer((p) => ({ ...p, referenceAssetKeys: p.referenceAssetKeys.filter((x) => x !== k) }))} aria-label="Elimină">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {!ver.referenceAssetKeys.length && <p className="text-xs text-muted">Nicio imagine.</p>}
              </div>
            </div>
            <div className="flex justify-between gap-2">
              {style ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    start(async () => {
                      await archiveStyleAction(style.id, !style.archived);
                      router.refresh();
                    })
                  }
                >
                  {style.archived ? "Restaurează stilul" : "Arhivează stilul"}
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={save} loading={pending}>
                {style ? "Salvează ca versiune nouă" : "Creează stilul"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-center gap-3 bg-subtle">
            {definition && (
              <>
                <TemplatePreviewLazy definition={definition} format={specs.find((s) => s.key === "feed_4x5")!} brand={brand} width={180} />
                <TemplatePreviewLazy definition={definition} format={specs.find((s) => s.key === "story_9x16")!} brand={brand} width={126} />
              </>
            )}
          </CardContent>
        </Card>
        {style && (
          <Card>
            <CardHeader>
              <CardTitle>Versiuni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{v.version}</span>
                      {v.id === currentVersionId && <Badge tone="green">live</Badge>}
                    </div>
                    <div className="text-xs text-muted">{formatDateTime(v.createdAt)}</div>
                    {v.changelog && <div className="mt-1 text-xs">{v.changelog}</div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" onClick={() => loadVersion(v)}>
                      Încarcă
                    </Button>
                    {v.id !== currentVersionId && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await publishStyleVersionAction(style.id, v.id);
                            if (r.ok) {
                              toast({ title: `v${v.version} e acum live`, tone: "success" });
                              router.refresh();
                            }
                          })
                        }
                      >
                        Publică versiunea
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
