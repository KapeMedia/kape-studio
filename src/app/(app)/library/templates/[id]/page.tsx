import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getTemplate, listTemplates } from "@/server/services/library";
import { PageHeader } from "@/components/ui";
import { TemplateEditor } from "@/components/library/template-editor";
import { ClientPicker } from "@/components/library/client-picker";
import { loadPreviewContext } from "../../shared";

export default async function TemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ client?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const pc = await loadPreviewContext(db, sp.client);
  let template;
  if (id === "new") {
    const first = (await listTemplates(db))[0];
    template = { id: null, name: "Template nou", description: "", definition: first?.definition ?? { layouts: { feed_4x5: { layers: [] } } } };
  } else {
    const t = await getTemplate(db, id);
    if (!t) notFound();
    template = { id: t.id, name: t.name, description: t.description, definition: t.definition };
  }
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-1 text-sm text-muted">
        <Link href="/library?tab=templates" className="hover:underline">
          Bibliotecă
        </Link>{" "}
        / Template-uri
      </div>
      <PageHeader title={template.name} actions={pc.clients.length > 0 && <ClientPicker clients={pc.clients} value={pc.client?.slug ?? ""} />} />
      <TemplateEditor template={template} brand={pc.brand} specs={pc.specs} />
    </div>
  );
}
