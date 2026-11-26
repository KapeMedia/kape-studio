import Link from "next/link";
import { getDb } from "@/server/db/client";
import { INDUSTRY_LABELS, listClients } from "@/server/services/clients";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ButtonLink } from "@/components/button-link";

export default async function DashboardPage() {
  const db = await getDb();
  const clients = await listClients(db);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        description="Clienții agenției și ultimele generări."
        actions={<ButtonLink href="/clients/new">Client nou</ButtonLink>}
      />
      {clients.length === 0 ? (
        <EmptyState title="Niciun client încă" description="Adaugă primul client ca să începi." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.slug}`}>
              <Card className="p-4 transition-colors hover:border-gray-300">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{c.name}</div>
                  <Badge>{INDUSTRY_LABELS[c.industry]}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description || "Fără descriere"}</p>
                <div className="mt-3 flex gap-1">
                  {c.colors.map((col) => (
                    <span key={col.hex + col.role} title={`${col.name} (${col.role})`} className="h-5 w-5 rounded border border-black/10" style={{ background: col.hex }} />
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
