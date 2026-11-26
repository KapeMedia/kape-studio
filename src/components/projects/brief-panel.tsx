"use client";

import { useState } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { Angle } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BriefOptions = {
  formats: { key: string; label: string }[];
  styles: { id: string; name: string; whenToUse: string }[];
  imageProviders: { id: "openai" | "gemini" | "mock"; label: string }[];
  defaultImageProvider: "openai" | "gemini" | "mock";
  referenceImages: { key: string; url: string; label: string }[];
};

const ANGLE_LABELS: Record<string, string> = {
  oferta: "Ofertă",
  durere: "Durere",
  rezultat: "Rezultat",
  social_proof: "Social proof",
  urgenta: "Urgență",
  altul: "Altul",
};

export function BriefPanel({ projectId, options, onGenerated }: { projectId: string; options: BriefOptions; onGenerated: () => void }) {
  const [message, setMessage] = useState("");
  const [cta, setCta] = useState("");
  const [notes, setNotes] = useState("");
  const [formats, setFormats] = useState<string[]>(["feed_4x5"]);
  const [styleId, setStyleId] = useState<string>("auto");
  const [count, setCount] = useState(4);
  const [refs, setRefs] = useState<string[]>([]);
  const [provider, setProvider] = useState(options.defaultImageProvider);
  const [angles, setAngles] = useState<(Angle & { selected: boolean })[]>([]);
  const [loadingAngles, setLoadingAngles] = useState(false);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  const brief = () => ({
    message,
    cta,
    notes,
    formats,
    styleId: styleId === "auto" ? null : styleId,
    variantCount: count,
    referenceKeys: refs,
    imageProvider: provider,
    angles: angles.filter((a) => a.selected).map(({ selected: _s, ...a }) => a),
  });

  const proposeAngles = async () => {
    if (message.trim().length < 3) return toast({ title: "Scrie întâi mesajul / oferta", tone: "error" });
    setLoadingAngles(true);
    try {
      const res = await fetch("/api/generations/angles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, brief: { ...brief(), angles: [] } }) });
      const json = (await res.json()) as { angles?: Angle[]; error?: string };
      if (!res.ok || !json.angles) throw new Error(json.error ?? "Eroare");
      setAngles(json.angles.map((a, i) => ({ ...a, selected: i < 2 })));
    } catch (e) {
      toast({ title: "Nu am putut propune unghiuri", description: e instanceof Error ? e.message : "", tone: "error" });
    } finally {
      setLoadingAngles(false);
    }
  };

  const generate = async () => {
    if (message.trim().length < 3) return toast({ title: "Scrie mesajul / oferta", tone: "error" });
    if (!formats.length) return toast({ title: "Bifează cel puțin un format", tone: "error" });
    setGenerating(true);
    try {
      const res = await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, brief: brief() }) });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Eroare");
      toast({ title: "Generare pornită", description: `${count} variante în lucru…` });
      onGenerated();
    } catch (e) {
      toast({ title: "Nu am putut porni generarea", description: e instanceof Error ? e.message : "", tone: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const updateAngle = (i: number, patch: Partial<Angle & { selected: boolean }>) => setAngles((p) => p.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <div className="space-y-4">
      <Field label="Mesaj / ofertă *">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-24" placeholder="ex: Reducere 40% la epilare definitivă zona inghinală, doar până pe 30 noiembrie" />
      </Field>
      <Field label="CTA" hint="Opțional. Dacă lipsește, îl propune AI-ul.">
        <Input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="ex: Programează-te" />
      </Field>
      <Field label="Note pentru generarea asta">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-14" placeholder="ce să evite de data asta, detalii" />
      </Field>
      <div>
        <div className="mb-1 text-xs font-medium text-gray-600">Formate</div>
        <div className="grid grid-cols-1 gap-1.5">
          {options.formats.map((f) => (
            <Checkbox key={f.key} checked={formats.includes(f.key)} onChange={(c) => setFormats((p) => (c ? [...p, f.key] : p.filter((x) => x !== f.key)))} label={f.label} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stil">
          <Select value={styleId} onValueChange={setStyleId} options={[{ value: "auto", label: "Alege tu" }, ...options.styles.map((s) => ({ value: s.id, label: s.name }))]} />
        </Field>
        <Field label="Variante">
          <Input type="number" min={1} max={8} value={count} onChange={(e) => setCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} />
        </Field>
      </div>
      <Field label="Provider imagine">
        <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)} options={options.imageProviders.map((p) => ({ value: p.id, label: p.label }))} />
      </Field>
      {options.referenceImages.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-gray-600">Imagini de referință (max 4)</div>
          <div className="grid grid-cols-5 gap-1.5">
            {options.referenceImages.map((r) => {
              const on = refs.includes(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  title={r.label}
                  onClick={() => setRefs((p) => (on ? p.filter((x) => x !== r.key) : p.length < 4 ? [...p, r.key] : p))}
                  className={cn("aspect-square overflow-hidden rounded-md border-2", on ? "border-accent" : "border-transparent opacity-70 hover:opacity-100")}
                >
                  <img src={r.url} alt="" className="h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {angles.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600">Unghiuri (bifează ce vrei; poți edita)</div>
          {angles.map((a, i) => (
            <div key={a.id} className={cn("rounded-lg border p-2", a.selected && "border-accent bg-accent-soft/40")}>
              <div className="mb-1 flex items-center justify-between">
                <Checkbox checked={a.selected} onChange={(c) => updateAngle(i, { selected: c })} label={<Badge tone="accent">{ANGLE_LABELS[a.type] ?? a.type}</Badge>} />
              </div>
              <Input className="mb-1 h-8 font-medium" value={a.headline} onChange={(e) => updateAngle(i, { headline: e.target.value })} aria-label="Headline" />
              <Input className="mb-1 h-8" value={a.subheadline ?? ""} onChange={(e) => updateAngle(i, { subheadline: e.target.value })} aria-label="Subheadline" />
              <Input className="h-8" value={a.cta} onChange={(e) => updateAngle(i, { cta: e.target.value })} aria-label="CTA" />
              <p className="mt-1 text-xs text-muted">{a.why}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={proposeAngles} loading={loadingAngles}>
          <Lightbulb className="h-4 w-4" /> Propune unghiuri
        </Button>
        <Button className="flex-1" onClick={generate} loading={generating}>
          <Sparkles className="h-4 w-4" /> Generează
        </Button>
      </div>
    </div>
  );
}
