import Link from "next/link";
import { count, gte } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { generations } from "@/server/db/schema";
import { INDUSTRY_LABELS, listClients } from "@/server/services/clients";
import { listGenerations } from "@/server/services/generation/queries";
import { costReport, monthStart } from "@/server/services/costs/report";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ButtonLink } from "@/components/button-link";
import { formatDateTime, formatUsd } from "@/lib/utils";

const MONTH = new Intl.DateTimeFormat("ro-RO", { month: "long" });

export default async function DashboardPage() {
  const db = await getDb();
  const from = monthStart();
  const [clientRows, recent, report, monthGens] = await Promise.all([
    listClients(db),
    listGenerations(db, { limit: 8, includeSnapshot: false }),
    costReport(db, from),
    db.select({ clientId: generations.clientId, n: count() }).from(generations).where(gte(generations.createdAt, from)).groupBy(generations.clientId),
  ]);
  const slugById = new Map(clientRows.map((c) => [c.id, c.slug]));
  const nameById = new Map(clientRows.map((c) => [c.id, c.name]));
  const approvedThisMonth = recent.flatMap((g) => g.variants).filter((v) => v.status === "approved" || v.status === "delivered").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Dashboard" description="Clienții agenției, ultimele generări și costul lunii." actions={<ButtonLink href="/clients/new">Client nou</ButtonLink>} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted">Cost {MONTH.format(new Date())}</div>
          <div className="mt-1 text-2xl font-semibold">{formatUsd(report.total)}</div>
          <Link href="/settings" className="text-xs text-accent hover:underline">
            detalii în Setări
          </Link>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Generări luna asta</div>
          <div className="mt-1 text-2xl font-semibold">{monthGens.reduce((a, r) => a + r.n, 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Variante aprobate (în ultimele generări)</div>
          <div className="mt-1 text-2xl font-semibold">{approvedThisMonth}</div>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Clienți</h2>
        {clientRows.length === 0 ? (
          <EmptyState title="Niciun client încă" description="Adaugă primul client ca să începi." action={<ButtonLink href="/clients/new">Client nou</ButtonLink>} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientRows.map((c) => {
              const cost = report.perClient.find((r) => r.clientId === c.id)?.cost ?? 0;
              const gens = monthGens.find((r) => r.clientId === c.id)?.n ?? 0;
              return (
                <Link key={c.id} href={`/clients/${c.slug}`}>
                  <Card className="p-4 transition-colors hover:border-gray-300">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{c.name}</div>
                      <Badge>{INDUSTRY_LABELS[c.industry]}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description || "Fără descriere"}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-1">
                        {c.colors.map((col) => (
                          <span key={col.hex + col.role} title={`${col.name} (${col.role})`} className="h-5 w-5 rounded border border-black/10" style={{ background: col.hex }} />
                        ))}
                      </div>
                      <span className="text-xs text-muted">
                        {gens} generări · {formatUsd(cost)}
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Ultimele generări</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 && <p className="text-sm text-muted">Nicio generare încă. Intră pe un client → proiect → Generează.</p>}
          {recent.map((g) => (
            <RecentRow key={g.id} g={g} slugById={slugById} nameById={nameById} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RecentRow({ g, slugById, nameById }: { g: Awaited<ReturnType<typeof listGenerations>>[number]; slugById: Map<string, string>; nameById: Map<string, string> }) {
  const slug = slugById.get(g.clientId);
  return (
    <div className="flex items-center gap-3">
      <div className="flex shrink-0 gap-1">
        {g.variants.slice(0, 4).map((v) => (
          <div key={v.id} className="h-12 w-10 overflow-hidden rounded border bg-subtle">
            {v.previewUrl && <img src={v.previewUrl} alt="" className="h-full w-full object-cover" />}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        {slug ? (
          <Link href={`/clients/${slug}/projects/${g.projectId}`} className="block truncate text-sm font-medium hover:underline">
            {g.brief.message}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium">{g.brief.message}</span>
        )}
        <div className="text-xs text-muted">
          {nameById.get(g.clientId) ?? ""} · {g.projectName} · {formatDateTime(g.createdAt)} · {g.authorName ?? "—"}
        </div>
      </div>
      <span className="text-xs text-muted">{formatUsd(g.costUsd)}</span>
    </div>
  );
}
