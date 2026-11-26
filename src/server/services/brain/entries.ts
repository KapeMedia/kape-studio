import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "../../db/connect";
import { brainEntries, brainEntryEvents, users, type BrainEntry } from "../../db/schema";
import type { BrainScope, BrainSource } from "@/lib/types";
import { normalizeDiacritics } from "@/lib/diacritics";

export const TRIAL_LIMIT = 15;
export const PROMOTE_AT_CONFIRMATIONS = 2;

async function event(db: DB, entryId: string, type: (typeof brainEntryEvents.$inferInsert)["type"], data: Record<string, unknown> = {}, actorId?: string | null) {
  await db.insert(brainEntryEvents).values({ entryId, type, data, actorId: actorId ?? null });
}

async function get(db: DB, id: string) {
  const [e] = await db.select().from(brainEntries).where(eq(brainEntries.id, id));
  if (!e) throw new Error("Regulă inexistentă");
  return e;
}

/** Keeps at most 15 trial rules per client: the oldest unconfirmed ones are archived. */
export async function enforceTrialLimit(db: DB, clientId: string, limit = TRIAL_LIMIT) {
  const trials = await db
    .select()
    .from(brainEntries)
    .where(and(eq(brainEntries.clientId, clientId), eq(brainEntries.status, "trial")))
    .orderBy(asc(brainEntries.confirmations), asc(brainEntries.createdAt));
  const excess = trials.length - limit;
  if (excess <= 0) return [];
  const unconfirmedFirst = [...trials.filter((t) => t.confirmations === 0 && !t.pinned), ...trials.filter((t) => t.confirmations > 0 || t.pinned)];
  const toArchive = unconfirmedFirst.slice(0, excess);
  for (const t of toArchive) {
    await db.update(brainEntries).set({ status: "archived" }).where(eq(brainEntries.id, t.id));
    await event(db, t.id, "archived", { reason: "trial_limit" });
  }
  return toArchive.map((t) => t.id);
}

export async function createTrialRule(
  db: DB,
  args: { clientId: string; text: string; scope: BrainScope; source: BrainSource; suggestAgencyWide: boolean; actorId?: string | null },
) {
  const [e] = await db
    .insert(brainEntries)
    .values({
      clientId: args.clientId,
      kind: "rule",
      text: normalizeDiacritics(args.text.trim()),
      status: "trial",
      scope: args.scope,
      source: args.source,
      createdBy: "ai",
      suggestAgencyWide: args.suggestAgencyWide,
    })
    .returning();
  await event(db, e!.id, "created", { via: "feedback", feedbackId: args.source.feedbackId }, args.actorId);
  await enforceTrialLimit(db, args.clientId);
  return e!;
}

/** Same idea seen again: confirmations++; a trial rule with ≥2 confirmations is promoted to active. */
export async function confirmByFeedback(db: DB, entryId: string, data: Record<string, unknown>, actorId?: string | null): Promise<BrainEntry> {
  const e = await get(db, entryId);
  const confirmations = e.confirmations + 1;
  const promote = e.status === "trial" && confirmations >= PROMOTE_AT_CONFIRMATIONS;
  const [u] = await db
    .update(brainEntries)
    .set({ confirmations, status: promote ? "active" : e.status === "archived" ? "trial" : e.status })
    .where(eq(brainEntries.id, entryId))
    .returning();
  await event(db, entryId, "confirmed", data, actorId);
  if (promote) await event(db, entryId, "promoted", { reason: "confirmations", confirmations }, actorId);
  return u!;
}

/** The user presses „Confirmă”: the rule becomes active immediately. */
export async function confirmEntry(db: DB, entryId: string, actorId?: string | null) {
  const e = await get(db, entryId);
  const [u] = await db
    .update(brainEntries)
    .set({ status: "active", confirmations: e.confirmations + 1 })
    .where(eq(brainEntries.id, entryId))
    .returning();
  await event(db, entryId, "confirmed", { manual: true }, actorId);
  if (e.status !== "active") await event(db, entryId, "promoted", { reason: "manual" }, actorId);
  return u!;
}

export const entryEditSchema = z.object({
  text: z.string().trim().min(3).optional(),
  scope: z.object({ formats: z.array(z.string()).optional(), styles: z.array(z.string()).optional() }).optional(),
  kind: z.enum(["rule", "fact", "preference"]).optional(),
  pinned: z.boolean().optional(),
});

export async function editEntry(db: DB, entryId: string, input: z.input<typeof entryEditSchema>, actorId?: string | null) {
  const e = await get(db, entryId);
  const data = entryEditSchema.parse(input);
  const patch = { ...data, ...(data.text ? { text: normalizeDiacritics(data.text) } : {}) };
  const [u] = await db.update(brainEntries).set(patch).where(eq(brainEntries.id, entryId)).returning();
  await event(db, entryId, "edited", { before: { text: e.text, scope: e.scope, kind: e.kind, pinned: e.pinned }, after: patch }, actorId);
  return u!;
}

/** „Șterge” in the UI = archive (nothing is hard-deleted in v1). */
export async function archiveEntry(db: DB, entryId: string, actorId?: string | null) {
  const [u] = await db.update(brainEntries).set({ status: "archived" }).where(eq(brainEntries.id, entryId)).returning();
  await event(db, entryId, "archived", { manual: true }, actorId);
  return u!;
}

export async function restoreEntry(db: DB, entryId: string, actorId?: string | null) {
  const e = await get(db, entryId);
  const status = e.createdBy === "user" || e.confirmations >= PROMOTE_AT_CONFIRMATIONS ? "active" : "trial";
  const [u] = await db.update(brainEntries).set({ status, createdAt: e.createdAt }).where(eq(brainEntries.id, entryId)).returning();
  await event(db, entryId, "restored", { status }, actorId);
  if (status === "trial" && e.clientId) await enforceTrialLimit(db, e.clientId);
  return u!;
}

/** Manually added entries are active immediately (createdBy: user). clientId null = agency rule. */
export async function addManualEntry(db: DB, args: { clientId: string | null; text: string; kind?: "rule" | "fact" | "preference"; scope?: BrainScope; authorId?: string | null; authorName?: string }) {
  const [e] = await db
    .insert(brainEntries)
    .values({
      clientId: args.clientId,
      kind: args.kind ?? "rule",
      text: normalizeDiacritics(args.text.trim()),
      status: "active",
      scope: args.scope ?? {},
      createdBy: "user",
      source: { authorId: args.authorId ?? undefined, authorName: args.authorName, date: new Date().toISOString().slice(0, 10) },
    })
    .returning();
  await event(db, e!.id, "created", { manual: true }, args.authorId);
  return e!;
}

/** „Fă-o regulă de agenție”: active copy with clientId null, linked to the original. */
export async function promoteToAgency(db: DB, entryId: string, actorId?: string | null) {
  const e = await get(db, entryId);
  const [agency] = await db
    .insert(brainEntries)
    .values({ clientId: null, kind: e.kind, text: e.text, status: "active", scope: e.scope, source: e.source, createdBy: "user" })
    .returning();
  await event(db, agency!.id, "created", { fromClientEntry: e.id }, actorId);
  await db.update(brainEntries).set({ suggestAgencyWide: false }).where(eq(brainEntries.id, e.id));
  await event(db, e.id, "promoted", { toAgency: agency!.id }, actorId);
  return agency!;
}

export type EntryView = BrainEntry & { events: { type: string; createdAt: Date; actorName: string | null; data: Record<string, unknown> }[] };

export async function listEntries(db: DB, clientId: string | null): Promise<EntryView[]> {
  const rows = await db
    .select()
    .from(brainEntries)
    .where(clientId ? eq(brainEntries.clientId, clientId) : isNull(brainEntries.clientId))
    .orderBy(desc(brainEntries.pinned), desc(brainEntries.createdAt));
  if (!rows.length) return [];
  const evs = await db
    .select({ e: brainEntryEvents, actorName: users.name })
    .from(brainEntryEvents)
    .leftJoin(users, eq(users.id, brainEntryEvents.actorId))
    .where(and(inArray(brainEntryEvents.entryId, rows.map((r) => r.id)), sql`${brainEntryEvents.type} <> 'used'`))
    .orderBy(desc(brainEntryEvents.createdAt));
  return rows.map((r) => ({
    ...r,
    events: evs.filter((x) => x.e.entryId === r.id).map((x) => ({ type: x.e.type, createdAt: x.e.createdAt, actorName: x.actorName, data: x.e.data })),
  }));
}
