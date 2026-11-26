import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getClientBySlug, getProject, listProjectReferences } from "@/server/services/clients";
import { fileUrl } from "@/server/providers/storage";
import { PageHeader } from "@/components/ui";
import { ReferencesPanel } from "@/components/projects/references-panel";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const db = await getDb();
  const client = await getClientBySlug(db, slug);
  const project = await getProject(db, id);
  if (!client || !project || project.clientId !== client.id) notFound();
  const refs = await listProjectReferences(db, project.id);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-1 text-sm text-muted">
        <Link href={`/clients/${slug}`} className="hover:underline">
          {client.name}
        </Link>{" "}
        / Proiecte
      </div>
      <PageHeader title={project.name} description={project.description} />
      <ReferencesPanel
        clientId={client.id}
        projectId={project.id}
        references={refs.map((r) => ({ id: r.id, url: fileUrl(r.storageKey), note: r.note, kind: r.kind }))}
      />
    </div>
  );
}
