import Link from "next/link";
import { getDb } from "@/server/db/client";
import { listGenerations } from "@/server/services/generation/queries";
import { Badge, EmptyState } from "@/components/ui";
import { QaBadge, STATUS_LABEL } from "@/components/projects/variant-card";
import { formatDateTime, formatUsd } from "@/lib/utils";
import { cn } from "@/lib/utils";

const GEN_STATUS: Record<string, { label: string; tone: "gray" | "blue" | "green" | "red" }> = {
  queued: { label: "în coadă", tone: "gray" },
  running: { label: "rulează", tone: "blue" },
  done: { label: "gata", tone: "green" },
  failed: { label: "eșuat", tone: "red" },
};

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("rounded-md px-2 py-1 text-xs", active ? "bg-accent text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}>
      {children}
    </Link>
  );
}

export async function HistoryTab({ clientId, slug, status, projectId, projects }: { clientId: string; slug: string; status?: string; projectId?: string; projects: { id: string; name: string }[] }) {
  const db = await getDb();
  const gens = await listGenerations(db, { clientId, projectId, status, limit: 100, includeSnapshot: false });
  const url = (p: { status?: string; project?: string }) => {
    const q = new URLSearchParams({ tab: "history" });
    if (p.status) q.set("status", p.status);
    if (p.project) q.set("project", p.project);
    return `/clients/${slug}?${q.toString()}`;
  };
  const total = gens.reduce((a, g) => a + g.costUsd, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Status:</span>
        <FilterLink href={url({ project: projectId })} active={!status}>
          toate
        </FilterLink>
        {Object.entries(GEN_STATUS).map(([k, v]) => (
          <FilterLink key={k} href={url({ status: k, project: projectId })} active={status === k}>
            {v.label}
          </FilterLink>
        ))}
        <span className="ml-4 text-xs text-muted">Proiect:</span>
        <FilterLink href={url({ status })} active={!projectId}>
          toate
        </FilterLink>
        {projects.map((p) => (
          <FilterLink key={p.id} href={url({ status, project: p.id })} active={projectId === p.id}>
            {p.name}
          </FilterLink>
        ))}
        <span className="ml-auto text-xs text-muted">
          {gens.length} generări · cost {formatUsd(total)}
        </span>
      </div>
      {gens.length === 0 && <EmptyState title="Nicio generare" description="Nu există generări pentru filtrele alese." />}
      {gens.map((g) => {
        const st = GEN_STATUS[g.status] ?? GEN_STATUS.queued!;
        return (
          <div key={g.id} className="rounded-lg border bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="truncate text-sm font-medium">{g.brief.message}</span>
                </div>
                <div className="text-xs text-muted">
                  {formatDateTime(g.createdAt)} · {g.authorName ?? "—"} ·{" "}
                  <Link href={`/clients/${slug}/projects/${g.projectId}`} className="hover:underline">
                    {g.projectName}
                  </Link>{" "}
                  · {g.styleName ?? "stil auto"} · {g.brief.formats.join(", ")} · {formatUsd(g.costUsd)}
                </div>
              </div>
            </div>
            {g.error && <p className="px-4 py-2 text-xs text-red-700">{g.error}</p>}
            <div className="flex gap-2 overflow-x-auto p-3">
              {g.variants.map((v) => {
                const s = STATUS_LABEL[v.status] ?? { label: v.status, tone: "gray" as const };
                return (
                  <Link key={v.id} href={`/clients/${slug}/variants/${v.id}`} className="w-32 shrink-0">
                    <div className="aspect-[4/5] overflow-hidden rounded-md border bg-subtle">
                      {v.previewUrl ? <img src={v.previewUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] text-muted">{s.label}</div>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {v.qa && <QaBadge qa={v.qa} />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
