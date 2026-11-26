"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  deleteBrandAssetAction,
  saveColorsAction,
  updateFontMetaAction,
  uploadBrandAssetsAction,
} from "@/app/actions/clients";
import { detectMissingGlyphs, loadFonts } from "@/editor/fonts";
import { FONT_PREVIEW_TEXT } from "@/lib/diacritics";
import { BRAND_ROLES } from "@/lib/template-types";
import type { BrandColor } from "@/lib/types";

export type AssetView = {
  id: string;
  type: "logo" | "logo_light" | "photo" | "font" | "other";
  name: string;
  url: string;
  width: number | null;
  height: number | null;
  meta: { family?: string; role?: "heading" | "body"; missingGlyphs?: string[] };
};

const ROLE_LABELS: Record<string, string> = {
  primary: "Primară",
  secondary: "Secundară",
  accent: "Accent",
  background: "Fundal",
  text: "Text",
};

function useUpload(clientId: string) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const upload = (type: string, files: FileList | File[], extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("type", type);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    for (const f of Array.from(files)) fd.append("files", f);
    start(async () => {
      const r = await uploadBrandAssetsAction(clientId, fd);
      if (r.ok) {
        toast({ title: "Încărcat", tone: "success" });
        router.refresh();
      } else toast({ title: "Upload eșuat", description: r.error, tone: "error" });
    });
  };
  return { upload, pending };
}

function UploadButton({ label, accept, multiple, onFiles, loading }: { label: string; accept: string; multiple?: boolean; onFiles: (f: FileList) => void; loading?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" loading={loading} onClick={() => ref.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> {label}
      </Button>
    </>
  );
}

function DeleteAsset({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Șterge"
      loading={pending}
      onClick={() =>
        start(async () => {
          await deleteBrandAssetAction(id);
          router.refresh();
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function LogosSection({ clientId, assets }: { clientId: string; assets: AssetView[] }) {
  const { upload, pending } = useUpload(clientId);
  const logo = assets.find((a) => a.type === "logo");
  const light = assets.find((a) => a.type === "logo_light");
  const slot = (title: string, type: "logo" | "logo_light", a: AssetView | undefined, hint: string) => (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted">{hint}</div>
        </div>
        <div className="flex items-center gap-1">
          {a && <DeleteAsset id={a.id} />}
          <UploadButton label={a ? "Înlocuiește" : "Încarcă"} accept="image/png,image/svg+xml,image/webp" onFiles={(f) => upload(type, f)} loading={pending} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex h-28 items-center justify-center rounded-lg border bg-white p-3">
          {a ? <img src={a.url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted">pe fundal deschis</span>}
        </div>
        <div className="flex h-28 items-center justify-center rounded-lg border bg-gray-900 p-3">
          {a ? <img src={a.url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-gray-400">pe fundal închis</span>}
        </div>
      </div>
    </div>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {slot("Logo principal", "logo", logo, "PNG transparent sau SVG")}
        {slot("Logo pentru fundal închis", "logo_light", light, "Opțional (varianta albă)")}
      </CardContent>
    </Card>
  );
}

export function ColorsSection({ clientId, colors: initial }: { clientId: string; colors: BrandColor[] }) {
  const [colors, setColors] = useState<BrandColor[]>(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const update = (i: number, patch: Partial<BrandColor>) => setColors((p) => p.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const dirty = JSON.stringify(colors) !== JSON.stringify(initial);
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Culori</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setColors((p) => [...p, { name: "Culoare nouă", hex: "#888888", role: p.some((c) => c.role === "primary") ? "accent" : "primary" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Adaugă
          </Button>
          <Button
            size="sm"
            disabled={!dirty}
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await saveColorsAction(clientId, colors);
                if (r.ok) {
                  toast({ title: "Culori salvate", tone: "success" });
                  router.refresh();
                } else toast({ title: "Nu am putut salva", description: r.error, tone: "error" });
              })
            }
          >
            Salvează
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {colors.length === 0 && <p className="text-sm text-muted">Nicio culoare. Fără culori, aplicația folosește o paletă neutră.</p>}
        {colors.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#000000"} onChange={(e) => update(i, { hex: e.target.value.toUpperCase() })} className="h-9 w-10 cursor-pointer rounded border bg-white p-0.5" aria-label="Alege culoarea" />
            <Input value={c.hex} onChange={(e) => update(i, { hex: e.target.value })} className="w-28 font-mono" aria-label="Hex" />
            <Input value={c.name} onChange={(e) => update(i, { name: e.target.value })} className="flex-1" aria-label="Nume" />
            <div className="w-40">
              <Select value={c.role} onValueChange={(r) => update(i, { role: r as BrandColor["role"] })} options={BRAND_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))} />
            </div>
            <Button variant="ghost" size="icon" aria-label="Elimină" onClick={() => setColors((p) => p.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FontRow({ font }: { font: AssetView }) {
  const family = `brand-${font.id}`;
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState<string[]>(font.meta.missingGlyphs ?? []);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [display, setDisplay] = useState(font.meta.family ?? "");
  useEffect(() => {
    let alive = true;
    loadFonts([{ family, url: font.url }]).then(() => {
      if (!alive) return;
      setReady(true);
      const m = detectMissingGlyphs(family);
      setMissing(m);
      if (JSON.stringify(m) !== JSON.stringify(font.meta.missingGlyphs ?? [])) {
        void updateFontMetaAction(font.id, { missingGlyphs: m });
      }
    });
    return () => {
      alive = false;
    };
  }, [family, font.url, font.id, font.meta.missingGlyphs]);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={display} onChange={(e) => setDisplay(e.target.value)} onBlur={() => display !== font.meta.family && start(async () => { await updateFontMetaAction(font.id, { family: display }); router.refresh(); })} className="h-8 w-48" aria-label="Familie" />
        <div className="w-32">
          <Select
            value={font.meta.role ?? "heading"}
            onValueChange={(r) => start(async () => { await updateFontMetaAction(font.id, { role: r as "heading" | "body" }); router.refresh(); })}
            options={[
              { value: "heading", label: "Titluri" },
              { value: "body", label: "Text" },
            ]}
            className="h-8"
          />
        </div>
        <span className="text-xs text-muted">{font.name}</span>
        {pending && <span className="text-xs text-muted">se salvează…</span>}
        <div className="ml-auto">
          <DeleteAsset id={font.id} />
        </div>
      </div>
      <p className="mt-3 text-2xl" style={{ fontFamily: ready ? `"${family}", Inter` : "Inter" }}>
        {FONT_PREVIEW_TEXT}
      </p>
      {ready && missing.length > 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" /> Fontul nu are glifele: {missing.join(" ")}. Se vor afișa cu fontul de rezervă.
        </p>
      )}
    </div>
  );
}

export function FontsSection({ clientId, assets }: { clientId: string; assets: AssetView[] }) {
  const fonts = assets.filter((a) => a.type === "font");
  const [family, setFamily] = useState("");
  const [role, setRole] = useState<"heading" | "body">(fonts.some((f) => f.meta.role === "heading") ? "body" : "heading");
  const { upload, pending } = useUpload(clientId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fonturi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Familie (opțional)">
            <Input value={family} onChange={(e) => setFamily(e.target.value)} placeholder="ex: Montserrat" className="w-48" />
          </Field>
          <Field label="Rol">
            <Select
              value={role}
              onValueChange={(r) => setRole(r as "heading" | "body")}
              options={[
                { value: "heading", label: "Titluri" },
                { value: "body", label: "Text" },
              ]}
              className="w-32"
            />
          </Field>
          <UploadButton label="Încarcă font" accept=".ttf,.otf,.woff2,.woff" onFiles={(f) => upload("font", f, { family, role })} loading={pending} />
        </div>
        {fonts.length === 0 ? (
          <p className="text-sm text-muted">Niciun font. Fallback: Inter.</p>
        ) : (
          fonts.map((f) => <FontRow key={f.id} font={f} />)
        )}
      </CardContent>
    </Card>
  );
}

export function PhotosSection({ clientId, assets }: { clientId: string; assets: AssetView[] }) {
  const photos = assets.filter((a) => a.type === "photo");
  const { upload, pending } = useUpload(clientId);
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Poze proprii</CardTitle>
          <p className="text-xs text-muted">Salon, produse, echipă, mâncare. Folosite ca referință pentru AI sau direct ca fundal.</p>
        </div>
        <UploadButton label="Încarcă poze" accept="image/png,image/jpeg,image/webp" multiple onFiles={(f) => upload("photo", f)} loading={pending} />
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <p className="text-sm text-muted">Nicio poză încă.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
            {photos.map((p) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border">
                <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                <div className="absolute top-1 right-1 rounded bg-white/90 opacity-0 group-hover:opacity-100">
                  <DeleteAsset id={p.id} />
                </div>
                {p.width && <Badge className="absolute bottom-1 left-1 bg-white/90">{p.width}×{p.height}</Badge>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
