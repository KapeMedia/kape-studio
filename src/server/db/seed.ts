import { count, eq } from "drizzle-orm";
import type { DB } from "./connect";
import * as s from "./schema";
import {
  DEMO_CLIENTS,
  SEED_AGENCY_RULES,
  SEED_FORMATS,
  SEED_STYLES,
  SEED_USERS,
} from "./seed-data";

/** Idempotent-ish seed: with onlyIfEmpty it does nothing once users exist. */
export async function seedDatabase(db: DB, opts: { onlyIfEmpty?: boolean } = {}) {
  const [row] = await db.select({ n: count() }).from(s.users);
  if (opts.onlyIfEmpty && (row?.n ?? 0) > 0) return { seeded: false };

  await db.insert(s.users).values(SEED_USERS).onConflictDoNothing();

  for (const f of SEED_FORMATS) {
    await db.insert(s.formats).values(f).onConflictDoNothing({ target: s.formats.key });
  }

  for (const st of SEED_STYLES) {
    const existing = await db.select().from(s.styles).where(eq(s.styles.slug, st.slug));
    if (existing.length) continue;
    const [tpl] = await db
      .insert(s.templates)
      .values({ name: st.template.name, description: st.template.description, definition: st.template.definition })
      .returning();
    const [style] = await db
      .insert(s.styles)
      .values({ name: st.name, slug: st.slug, description: st.description, whenToUse: st.whenToUse })
      .returning();
    if (!tpl || !style) throw new Error("seed: insert failed");
    const [ver] = await db
      .insert(s.styleVersions)
      .values({
        styleId: style.id,
        version: 1,
        templateId: tpl.id,
        visualPrompt: st.visualPrompt,
        avoid: st.avoid,
        copyGuidance: st.copyGuidance,
        textMode: "overlay",
        changelog: "Versiunea inițială (seed).",
      })
      .returning();
    await db.update(s.styles).set({ currentVersionId: ver!.id }).where(eq(s.styles.id, style.id));
  }

  for (const c of DEMO_CLIENTS) {
    const existing = await db.select().from(s.clients).where(eq(s.clients.slug, c.slug));
    if (existing.length) continue;
    const { project, ...clientData } = c;
    const [client] = await db.insert(s.clients).values(clientData).returning();
    await db.insert(s.projects).values({ clientId: client!.id, ...project });
  }

  const agencyRules = await db.select({ n: count() }).from(s.brainEntries);
  if ((agencyRules[0]?.n ?? 0) === 0) {
    for (const text of SEED_AGENCY_RULES) {
      const [e] = await db
        .insert(s.brainEntries)
        .values({ clientId: null, kind: "rule", text, status: "active", createdBy: "user" })
        .returning();
      await db.insert(s.brainEntryEvents).values({ entryId: e!.id, type: "created", data: { seed: true } });
    }
  }

  return { seeded: true };
}
