import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { generations } from "@/server/db/schema";
import { INDUSTRY_LABELS, getClientBySlug, listBrandAssets, listProjects } from "@/server/services/clients";
import { fileUrl } from "@/server/providers/storage";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { TabLinks } from "@/components/tab-links";
import { ClientForm } from "@/components/clients/client-form";
import { ColorsSection, FontsSection, LogosSection, PhotosSection, type AssetView } from "@/components/clients/brand-kit";
import { NewProjectButton, ProjectsList } from "@/components/clients/projects";
import { ArchiveClientButton } from "@/components/clients/archive-client-button";
import { BrainTab } from "@/components/brain/brain-tab";
import { HistoryTab } from "@/components/clients/history-tab";
import { runMaintenance } from "@/server/services/brain/maintenance";

const TABS = [
  { key: "overview", label: "Prezentare" },
  { key: "brand", label: "Brand kit" },
  { key: "brain", label: "Brain" },
  { key: "projects", label: "Proiecte" },
  { key: "history", label: "Istoric" },
];

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; status?: string; project?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "overview";
  const db = await getDb();
  const client = await getClientBySlug(db, slug);
  if (!client) notFound();
  await runMaintenance(db).catch(() => 0);

  const assets = await listBrandAssets(db, client.id);
  const assetViews: AssetView[] = assets.map((a) => ({
    id: a.id,
    type: a.type,
    name: a.name,
    url: fileUrl(a.storageKey)!,
    width: a.width,
    height: a.height,
    meta: a.meta,
  }));
  const projectRows = await listProjects(db, client.id, { includeArchived: true });
  const genCounts = await db
    .select({ projectId: generations.projectId, n: count() })
    .from(generations)
    .where(eq(generations.clientId, client.id))
    .groupBy(generations.projectId);
  const projects = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    generations: genCounts.find((g) => g.projectId === p.id)?.n ?? 0,
  }));
  const logo = assetViews.find((a) => a.type === "logo");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {logo && <img src={logo.url} alt="" className="h-8 w-auto max-w-24 object-contain" />}
            {client.name}
            {client.archivedAt && <Badge tone="yellow">arhivat</Badge>}
          </span>
        }
        description={`${INDUSTRY_LABELS[client.industry]} · ${projects.filter((p) => p.status === "active").length} proiecte active`}
        actions={<NewProjectButton clientId={client.id} slug={client.slug} />}
      />
      <TabLinks base={`/clients/${slug}`} active={tab} tabs={TABS} />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Despre client</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientForm
                clientId={client.id}
                initial={{
                  name: client.name,
                  industry: client.industry,
                  description: client.description,
                  audience: client.audience,
                  tone: client.tone,
                  dos: client.dos,
                  donts: client.donts,
                  activeOffers: client.activeOffers,
                }}
              />
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Proiecte recente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {projects.filter((p) => p.status === "active").slice(0, 5).map((p) => (
                  <Link key={p.id} href={`/clients/${slug}/projects/${p.id}`} className="block rounded-md px-2 py-1.5 text-sm hover:bg-gray-50">
                    {p.name} <span className="text-xs text-muted">· {p.generations} generări</span>
                  </Link>
                ))}
                {!projects.length && <p className="text-sm text-muted">Niciun proiect.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Paletă</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {client.colors.map((c) => (
                  <div key={c.hex + c.role} className="flex items-center gap-2 text-xs">
                    <span className="h-6 w-6 rounded border border-black/10" style={{ background: c.hex }} />
                    {c.name}
                  </div>
                ))}
                {!client.colors.length && <p className="text-sm text-muted">Nicio culoare.</p>}
              </CardContent>
            </Card>
            <ArchiveClientButton clientId={client.id} archived={!!client.archivedAt} />
          </div>
        </div>
      )}

      {tab === "brand" && (
        <div className="space-y-4">
          <LogosSection clientId={client.id} assets={assetViews} />
          <ColorsSection clientId={client.id} colors={client.colors} />
          <FontsSection clientId={client.id} assets={assetViews} />
          <PhotosSection clientId={client.id} assets={assetViews} />
          <p className="text-xs text-muted">Descrierea, publicul, tonul, do/don&apos;t și ofertele se editează în tab-ul Prezentare.</p>
        </div>
      )}

      {tab === "brain" && <BrainTab clientId={client.id} />}

      {tab === "projects" && <ProjectsList slug={slug} projects={projects} />}

      {tab === "history" && <HistoryTab clientId={client.id} slug={slug} status={sp.status} projectId={sp.project} projects={projects} />}
    </div>
  );
}
