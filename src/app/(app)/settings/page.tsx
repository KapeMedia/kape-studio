import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { providerStatuses } from "@/server/services/provider-status";
import { costReport, monthStart } from "@/server/services/costs/report";
import { PRICES } from "@/server/services/costs/prices";
import { getDefaultImageProviderId, imageProviderById } from "@/server/providers";
import { listArchivedClients } from "@/server/services/clients";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { DefaultImageProvider, TestConnectionButton } from "@/components/settings/provider-controls";
import { ArchiveClientButton } from "@/components/clients/archive-client-button";
import { formatDateTime, formatUsd } from "@/lib/utils";

const MONTH = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" });

export default async function SettingsPage() {
  const db = await getDb();
  const [statuses, report, defaultProvider, userRows, archived] = await Promise.all([
    providerStatuses(db),
    costReport(db, monthStart()),
    getDefaultImageProviderId(db),
    db.select().from(users).orderBy(asc(users.id)),
    listArchivedClients(db),
  ]);
  const storage = process.env.STORAGE_DRIVER === "supabase" && process.env.SUPABASE_URL ? "Supabase Storage" : "local (.data/uploads)";
  const database = process.env.DATABASE_URL ? "Postgres (DATABASE_URL)" : "PGlite local (.data/pglite)";
  const authMode = process.env.TEAM_PASSWORD ? "parolă de echipă" : "login automat (fără TEAM_PASSWORD)";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Setări" description="Provideri AI, costuri, utilizatori." />

      <Card>
        <CardHeader>
          <CardTitle>Provideri</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {statuses.map((s) => (
            <div key={s.key} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.label}</span>
                  {s.state === "active" && <Badge tone="green">activ</Badge>}
                  {s.state === "mock" && <Badge tone="yellow">mock (lipsă cheie)</Badge>}
                  {s.state === "error" && <Badge tone="red">eroare la ultimul apel</Badge>}
                  {s.priceTodo && <Badge tone="gray">TODO preț</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  model <code>{s.model}</code> · cheie <code>{s.envKey}</code>
                  {s.lastCallAt && ` · ultimul apel ${formatDateTime(s.lastCallAt)}`}
                </div>
                {s.lastError && <p className="mt-1 text-xs text-red-700">{s.lastError}</p>}
                {s.priceNote && <p className="mt-1 text-xs text-muted">{s.priceNote}</p>}
              </div>
              <TestConnectionButton provider={s.key} />
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-medium">Provider implicit de imagine</div>
              <div className="text-xs text-muted">Se poate schimba pe fiecare brief. Fără cheie, se folosește automat mock-ul.</div>
            </div>
            <DefaultImageProvider
              value={defaultProvider}
              options={(["openai", "gemini", "mock"] as const).map((id) => ({
                value: id,
                label: `${id === "openai" ? "OpenAI gpt-image" : id === "gemini" ? "Gemini" : "Mock (local)"}${id !== "mock" && !imageProviderById(id).isConfigured() ? " (mock, lipsă cheie)" : ""}`,
              }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Costuri: {MONTH.format(new Date())}</CardTitle>
          <span className="text-lg font-semibold">{formatUsd(report.total)}</span>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Pe client</div>
            {report.perClient.length === 0 && <p className="text-sm text-muted">Niciun apel luna asta.</p>}
            <table className="w-full text-sm">
              <tbody>
                {report.perClient.map((r) => (
                  <tr key={r.clientId ?? "none"} className="border-b last:border-0">
                    <td className="py-1.5">{r.slug ? <Link href={`/clients/${r.slug}?tab=history`} className="hover:underline">{r.name}</Link> : <span className="text-muted">fără client (teste)</span>}</td>
                    <td className="py-1.5 text-right text-muted">{r.calls} apeluri</td>
                    <td className="py-1.5 text-right font-medium">{formatUsd(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Pe provider</div>
            <table className="w-full text-sm">
              <tbody>
                {report.perProvider.map((r) => (
                  <tr key={r.provider + r.model} className="border-b last:border-0">
                    <td className="py-1.5">
                      {r.provider} <span className="text-xs text-muted">{r.model}</span>
                    </td>
                    <td className="py-1.5 text-right text-muted">
                      {r.calls} apeluri{r.failed ? `, ${r.failed} eșuate` : ""}
                    </td>
                    <td className="py-1.5 text-right font-medium">{formatUsd(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:col-span-2">
            <div className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Tabel de prețuri (USD / 1M tokeni), editabil în src/server/services/costs/prices.ts</div>
            <table className="w-full text-xs">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1">Model</th>
                  <th>Text in</th>
                  <th>Text out</th>
                  <th>Imagine in</th>
                  <th>Imagine out</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {Object.entries(PRICES).map(([k, p]) => (
                  <tr key={k} className="border-t">
                    <td className="py-1 font-mono">{k}</td>
                    <td>${p.input}</td>
                    <td>${p.output}</td>
                    <td>{p.imageInput !== undefined ? `$${p.imageInput}` : "—"}</td>
                    <td>{p.imageOutput !== undefined ? `$${p.imageOutput}` : "—"}</td>
                    <td>{p.todo && <Badge tone="yellow">TODO: preț neverificat</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utilizatori și mediu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {userRows.map((u) => (
              <Badge key={u.id} tone={u.role === "owner" ? "accent" : "gray"}>
                {u.name} · {u.role === "owner" ? "fondator" : "editor"}
              </Badge>
            ))}
          </div>
          <p className="text-muted">
            Bază de date: {database} · Storage: {storage} · Autentificare: {authMode}
          </p>
        </CardContent>
      </Card>

      {archived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Clienți arhivați</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {archived.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <Link href={`/clients/${c.slug}`} className="hover:underline">
                  {c.name}
                </Link>
                <ArchiveClientButton clientId={c.id} archived />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
