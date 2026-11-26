import { getDb } from "@/server/db/client";
import { listEntries } from "@/server/services/brain/entries";
import { listFormats } from "@/server/services/library";
import { EntryList } from "./entry-list";
import { toEntryRows } from "./brain-tab";

export async function AgencyRules() {
  const db = await getDb();
  const [entries, formats] = await Promise.all([listEntries(db, null), listFormats(db)]);
  return (
    <div>
      <p className="mb-4 text-sm text-muted">Regulile de agenție intră în generarea pentru orice client, înaintea regulilor clientului. Cererea utilizatorului le bate pe toate.</p>
      <EntryList entries={toEntryRows(entries)} clientId={null} slug={null} formats={formats.map((f) => f.key)} />
    </div>
  );
}
