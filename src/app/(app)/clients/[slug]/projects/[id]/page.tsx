import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getClientBySlug, getProject, listProjectReferences } from "@/server/services/clients";
import { listFormats, listStyles } from "@/server/services/library";
import { getBrandContext } from "@/server/services/brand";
import { listGenerations } from "@/server/services/generation/queries";
import { getDefaultImageProviderId, imageProviderById } from "@/server/providers";
import { fileUrl } from "@/server/providers/storage";
import { PageHeader } from "@/components/ui";
import { ReferencesPanel } from "@/components/projects/references-panel";
import { ProjectWorkspace } from "@/components/projects/generations-panel";
import type { BriefOptions } from "@/components/projects/brief-panel";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const db = await getDb();
  const client = await getClientBySlug(db, slug);
  const project = await getProject(db, id);
  if (!client || !project || project.clientId !== client.id) notFound();
  const [refs, fmts, styleRows, brand, gens, defaultProvider] = await Promise.all([
    listProjectReferences(db, project.id),
    listFormats(db, { enabledOnly: true }),
    listStyles(db),
    getBrandContext(db, client),
    listGenerations(db, { projectId: project.id }),
    getDefaultImageProviderId(db),
  ]);

  const providers = (["openai", "gemini", "mock"] as const).map((pid) => {
    const p = imageProviderById(pid);
    const name = pid === "openai" ? "OpenAI gpt-image" : pid === "gemini" ? "Gemini (Nano Banana Pro)" : "Mock (local)";
    return { id: pid, label: p.isConfigured() || pid === "mock" ? name : `${name}: mock, lipsă cheie` };
  });
  const options: BriefOptions = {
    formats: fmts.map((f) => ({ key: f.key, label: f.label })),
    styles: styleRows.filter((r) => r.version).map(({ style }) => ({ id: style.id, name: style.name, whenToUse: style.whenToUse })),
    imageProviders: providers,
    defaultImageProvider: defaultProvider,
    referenceImages: [
      ...brand.photos.map((p) => ({ key: p.key, url: fileUrl(p.key)!, label: `Brand kit: ${p.name}` })),
      ...refs.filter((r) => r.kind === "inspiration" && r.storageKey).map((r) => ({ key: r.storageKey!, url: fileUrl(r.storageKey)!, label: "Inspirație proiect" })),
    ],
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-1 text-sm text-muted">
        <Link href={`/clients/${slug}`} className="hover:underline">
          {client.name}
        </Link>{" "}
        /{" "}
        <Link href={`/clients/${slug}?tab=projects`} className="hover:underline">
          Proiecte
        </Link>
      </div>
      <PageHeader title={project.name} description={project.description} />
      <ProjectWorkspace projectId={project.id} slug={slug} initial={gens} options={options} fonts={brand.fontSources} />
      <div className="mt-8">
        <ReferencesPanel clientId={client.id} projectId={project.id} references={refs.map((r) => ({ id: r.id, url: fileUrl(r.storageKey), note: r.note, kind: r.kind }))} />
      </div>
    </div>
  );
}
