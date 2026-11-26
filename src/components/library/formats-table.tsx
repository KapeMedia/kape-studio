"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Checkbox, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { updateFormatAction } from "@/app/actions/library";
import type { SafeZone } from "@/lib/types";

type FormatRow = { id: string; key: string; label: string; width: number; height: number; safeZone: SafeZone; notes: string; enabled: boolean };

function FormatEditor({ f }: { f: FormatRow }) {
  const [v, setV] = useState(f);
  const [avoid, setAvoid] = useState(JSON.stringify(f.safeZone.avoidRects ?? []));
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const num = (s: string) => Math.max(0, Math.round(Number(s) || 0));
  const sz = (k: keyof Omit<SafeZone, "avoidRects">, val: string) => setV((p) => ({ ...p, safeZone: { ...p.safeZone, [k]: num(val) } }));
  const save = () =>
    start(async () => {
      let avoidRects: SafeZone["avoidRects"];
      try {
        avoidRects = JSON.parse(avoid || "[]");
      } catch {
        toast({ title: "avoidRects nu e JSON valid", tone: "error" });
        return;
      }
      const r = await updateFormatAction(f.id, { label: v.label, width: v.width, height: v.height, notes: v.notes, enabled: v.enabled, safeZone: { ...v.safeZone, avoidRects } });
      if (r.ok) {
        toast({ title: "Format salvat", tone: "success" });
        router.refresh();
      } else toast({ title: "Eroare", description: r.error, tone: "error" });
    });
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{f.key}</code>
          {!v.enabled && <Badge tone="yellow">dezactivat</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <Checkbox checked={v.enabled} onChange={(e) => setV((p) => ({ ...p, enabled: e }))} label="Activ" />
          <Button size="sm" loading={pending} onClick={save}>
            Salvează
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-8">
        <label className="col-span-2 text-xs text-muted">
          Etichetă
          <Input value={v.label} onChange={(e) => setV((p) => ({ ...p, label: e.target.value }))} />
        </label>
        <label className="text-xs text-muted">
          Lățime
          <Input type="number" value={v.width} onChange={(e) => setV((p) => ({ ...p, width: num(e.target.value) }))} />
        </label>
        <label className="text-xs text-muted">
          Înălțime
          <Input type="number" value={v.height} onChange={(e) => setV((p) => ({ ...p, height: num(e.target.value) }))} />
        </label>
        {(["top", "right", "bottom", "left"] as const).map((k) => (
          <label key={k} className="text-xs text-muted">
            Safe {k === "top" ? "sus" : k === "bottom" ? "jos" : k === "left" ? "stânga" : "dreapta"}
            <Input type="number" value={v.safeZone[k]} onChange={(e) => sz(k, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-muted">
          Zone de evitat (avoidRects, JSON px)
          <Input value={avoid} onChange={(e) => setAvoid(e.target.value)} className="font-mono text-xs" />
        </label>
        <label className="text-xs text-muted">
          Note
          <Textarea value={v.notes} onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))} className="min-h-9" />
        </label>
      </div>
    </Card>
  );
}

export function FormatsTable({ formats }: { formats: FormatRow[] }) {
  return (
    <div className="space-y-3">
      {formats.map((f) => (
        <FormatEditor key={f.id + f.width + f.height} f={f} />
      ))}
    </div>
  );
}
