"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, EmptyState } from "@/components/ui";
import type { GenerationView } from "@/server/services/generation/queries";
import { PreviewBakerLazy } from "@/editor/lazy";
import type { BakeJob } from "@/editor/preview-baker";
import type { FontSource } from "@/editor/fonts";
import { formatDateTime, formatUsd } from "@/lib/utils";
import { VariantCard } from "./variant-card";
import { WhyDialog } from "./why-dialog";
import { BriefPanel, type BriefOptions } from "./brief-panel";

const GEN_STATUS: Record<string, { label: string; tone: "gray" | "blue" | "green" | "red" }> = {
  queued: { label: "în coadă", tone: "gray" },
  running: { label: "rulează", tone: "blue" },
  done: { label: "gata", tone: "green" },
  failed: { label: "eșuat", tone: "red" },
};

export function ProjectWorkspace({
  projectId,
  slug,
  initial,
  options,
  fonts,
}: {
  projectId: string;
  slug: string;
  initial: GenerationView[];
  options: BriefOptions;
  fonts: FontSource[];
}) {
  const [gens, setGens] = useState(initial);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/generations?projectId=${projectId}`, { cache: "no-store" });
    if (res.ok) setGens(((await res.json()) as { generations: GenerationView[] }).generations);
  }, [projectId]);

  const busy = gens.some((g) => g.status === "queued" || g.status === "running" || g.variants.some((v) => v.status === "pending" || (!v.previewUrl && v.masterDoc && v.status !== "failed") || (v.previewUrl && !v.qa)));
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => {
      void refresh().then(() => setTick((x) => x + 1));
    }, 2000);
    return () => clearTimeout(t);
  }, [busy, tick, refresh]);

  const jobs: BakeJob[] = useMemo(
    () =>
      gens.flatMap((g) =>
        g.variants.filter((v) => !v.previewUrl && v.masterDoc && v.status !== "pending" && v.status !== "failed").map((v) => ({ variantId: v.id, doc: v.masterDoc!, version: v.documentVersion })),
      ),
    [gens],
  );
  const onBaked = useCallback(() => void refresh(), [refresh]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="h-fit rounded-lg border bg-white p-4 lg:sticky lg:top-16">
        <h2 className="mb-3 text-sm font-semibold">Brief</h2>
        <BriefPanel projectId={projectId} options={options} onGenerated={() => void refresh()} />
      </aside>
      <section className="min-w-0 space-y-6">
        {gens.length === 0 && <EmptyState title="Nicio generare încă" description="Scrie brief-ul în stânga și apasă Generează." />}
        {gens.map((g) => {
          const st = GEN_STATUS[g.status] ?? GEN_STATUS.queued!;
          return (
            <div key={g.id} className="rounded-lg border bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="truncate text-sm font-medium">{g.brief.message}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {formatDateTime(g.createdAt)} · {g.authorName ?? "—"} · {g.styleName ?? "stil auto"} · {g.brief.formats.join(", ")} · cost {formatUsd(g.costUsd)}
                    {g.imageProvider && ` · ${g.imageProvider.split(":")[0]}`}
                  </div>
                </div>
                <WhyDialog snapshot={g.snapshot} />
              </div>
              {g.error && <p className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">{g.error}</p>}
              <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 xl:grid-cols-4">
                {g.variants.map((v) => (
                  <VariantCard key={v.id} v={v} slug={slug} onChanged={() => void refresh()} />
                ))}
                {g.variants.length === 0 && (g.status === "queued" || g.status === "running") && (
                  <div className="col-span-full py-8 text-center text-sm text-muted">Scriu copy-ul și direcția vizuală…</div>
                )}
              </div>
            </div>
          );
        })}
      </section>
      <PreviewBakerLazy jobs={jobs} fonts={fonts} onDone={onBaked} />
    </div>
  );
}
