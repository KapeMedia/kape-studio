import { getDb } from "@/server/db/client";
import { listStyles, listTemplates } from "@/server/services/library";
import { PageHeader } from "@/components/ui";
import { TabLinks } from "@/components/tab-links";
import { ButtonLink } from "@/components/button-link";
import { ClientPicker } from "@/components/library/client-picker";
import { FormatsTable } from "@/components/library/formats-table";
import { StyleCards, TemplateCards } from "@/components/library/style-cards";
import { AgencyRules } from "@/components/brain/agency-rules";
import { loadPreviewContext } from "./shared";

const TABS = [
  { key: "styles", label: "Stiluri" },
  { key: "templates", label: "Template-uri" },
  { key: "formats", label: "Formate" },
  { key: "rules", label: "Reguli agenție" },
];

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string; client?: string; archived?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "styles";
  const db = await getDb();
  const pc = await loadPreviewContext(db, sp.client);
  const clientSlug = pc.client?.slug ?? "";
  const tabs = TABS.map((t) => ({ ...t }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Bibliotecă"
        description="Rețetele vizuale ale agenției: stiluri, template-uri, formate și reguli comune."
        actions={
          <>
            {pc.clients.length > 0 && (tab === "styles" || tab === "templates") && <ClientPicker clients={pc.clients} value={clientSlug} />}
            {tab === "styles" && <ButtonLink href={`/library/styles/new?client=${clientSlug}`}>Stil nou</ButtonLink>}
            {tab === "templates" && <ButtonLink href={`/library/templates/new?client=${clientSlug}`}>Template nou</ButtonLink>}
          </>
        }
      />
      <TabLinks base="/library" active={tab} tabs={tabs.map((t) => ({ ...t, key: t.key }))} />

      {tab === "styles" && (
        <StylesTab db={db} showArchived={sp.archived === "1"} brand={pc.brand} feed={pc.spec("feed_4x5")} story={pc.spec("story_9x16")} clientSlug={clientSlug} templatesById={Object.fromEntries((await listTemplates(db)).map((t) => [t.id, t.definition]))} />
      )}
      {tab === "templates" && <TemplateCards templates={await listTemplates(db)} brand={pc.brand} feed={pc.spec("feed_4x5")} story={pc.spec("story_9x16")} clientSlug={clientSlug} />}
      {tab === "formats" && (
        <FormatsTable formats={pc.formats.map((f) => ({ id: f.id, key: f.key, label: f.label, width: f.width, height: f.height, safeZone: f.safeZone, notes: f.notes, enabled: f.enabled }))} />
      )}
      {tab === "rules" && <AgencyRules />}
    </div>
  );
}

async function StylesTab({
  db,
  showArchived,
  templatesById,
  ...rest
}: {
  db: Awaited<ReturnType<typeof getDb>>;
  showArchived: boolean;
  templatesById: Record<string, import("@/lib/template-types").TemplateDefinition>;
} & Omit<Parameters<typeof StyleCards>[0], "styles">) {
  const rows = await listStyles(db, { includeArchived: showArchived });
  const styles = rows.map(({ style, version }) => ({
    id: style.id,
    name: style.name,
    description: style.description,
    whenToUse: style.whenToUse,
    version: version?.version ?? null,
    archived: !!style.archivedAt,
    definition: version ? (templatesById[version.templateId] ?? null) : null,
  }));
  return (
    <div>
      <StyleCards styles={styles} {...rest} />
      <div className="mt-4 text-right text-xs">
        <a className="text-muted hover:underline" href={`/library?tab=styles&client=${rest.clientSlug}${showArchived ? "" : "&archived=1"}`}>
          {showArchived ? "Ascunde stilurile arhivate" : "Arată și stilurile arhivate"}
        </a>
      </div>
    </div>
  );
}
