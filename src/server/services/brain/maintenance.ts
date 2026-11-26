import { and, eq, lt, sql } from "drizzle-orm";
import type { DB } from "../../db/connect";
import { brainEntries, brainEntryEvents } from "../../db/schema";

export const TRIAL_MAX_AGE_DAYS = 30;

/**
 * Archives trial rules that were never confirmed and never used for 30 days.
 * Runs at startup and whenever a client page is opened (no cron in v1).
 */
export async function runMaintenance(db: DB, now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - TRIAL_MAX_AGE_DAYS * 24 * 3600 * 1000);
  const stale = await db
    .select({ id: brainEntries.id })
    .from(brainEntries)
    .where(
      and(
        eq(brainEntries.status, "trial"),
        eq(brainEntries.confirmations, 0),
        lt(brainEntries.createdAt, cutoff),
        sql`(${brainEntries.lastUsedAt} is null or ${brainEntries.lastUsedAt} < ${cutoff.toISOString()})`,
      ),
    );
  for (const { id } of stale) {
    await db.update(brainEntries).set({ status: "archived" }).where(eq(brainEntries.id, id));
    await db.insert(brainEntryEvents).values({ entryId: id, type: "archived", data: { reason: "stale_30_days" } });
  }
  return stale.length;
}
