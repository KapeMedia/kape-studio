import { getDb } from "@/server/db/client";
import { listEntries, type EntryView } from "@/server/services/brain/entries";
import { listFormats } from "@/server/services/library";
import { EntryList, type EntryRow } from "./entry-list";

export function toEntryRows(entries: EntryView[]): EntryRow[] {
  return entries.map((e) => ({
    id: e.id,
    text: e.text,
    kind: e.kind,
    status: e.status,
    scope: e.scope,
    confirmations: e.confirmations,
    uses: e.uses,
    lastUsedAt: e.lastUsedAt?.toISOString() ?? null,
    pinned: e.pinned,
    createdBy: e.createdBy,
    suggestAgencyWide: e.suggestAgencyWide,
    createdAt: e.createdAt.toISOString(),
    source: e.source,
    events: e.events.map((ev) => ({ type: ev.type, createdAt: ev.createdAt.toISOString(), actorName: ev.actorName })),
  }));
}

export async function BrainTab({ clientId, slug }: { clientId: string; slug?: string }) {
  const db = await getDb();
  const [entries, formats] = await Promise.all([listEntries(db, clientId), listFormats(db)]);
  return <EntryList entries={toEntryRows(entries)} clientId={clientId} slug={slug ?? null} formats={formats.map((f) => f.key)} />;
}
