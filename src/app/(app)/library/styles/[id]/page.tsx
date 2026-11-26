import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getStyle, listTemplates } from "@/server/services/library";
import { PageHeader } from "@/components/ui";
import { StyleForm } from "@/components/library/style-form";
import { ClientPicker } from "@/components/library/client-picker";
import { loadPreviewContext } from "../../shared";

export default async function StylePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ client?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const pc = await loadPreviewContext(db, sp.client);
  const templates = (await listTemplates(db)).map((t) => ({ id: t.id, name: t.name, definition: t.definition }));
  const isNew = id === "new";
  const data = isNew ? null : await getStyle(db, id);
  if (!isNew && !data) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-1 text-sm text-muted">
        <Link href="/library?tab=styles" className="hover:underline">
          Bibliotecă
        </Link>{" "}
        / Stiluri
      </div>
      <PageHeader
        title={isNew ? "Stil nou" : data!.style.name}
        description="Salvarea creează o versiune nouă. Versiunea folosită la generare se schimbă doar la „Publică versiunea”."
        actions={pc.clients.length > 0 && <ClientPicker clients={pc.clients} value={pc.client?.slug ?? ""} />}
      />
      <StyleForm
        style={data ? { id: data.style.id, name: data.style.name, description: data.style.description, whenToUse: data.style.whenToUse, archived: !!data.style.archivedAt } : null}
        versions={(data?.versions ?? []).map((v) => ({
          id: v.id,
          version: v.version,
          templateId: v.templateId,
          visualPrompt: v.visualPrompt,
          avoid: v.avoid,
          copyGuidance: v.copyGuidance,
          referenceAssetKeys: v.referenceAssetKeys,
          textMode: v.textMode,
          changelog: v.changelog,
          createdAt: v.createdAt.toISOString(),
        }))}
        currentVersionId={data?.style.currentVersionId ?? null}
        templates={templates}
        brand={pc.brand}
        specs={pc.specs}
      />
    </div>
  );
}
