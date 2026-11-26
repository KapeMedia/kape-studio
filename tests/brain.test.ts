import { describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { testDb } from "./helpers";
import type { DB } from "@/server/db/connect";
import { brainEntries, brainEntryEvents, clients, feedback, formats, projects, variants } from "@/server/db/schema";
import { submitFeedback } from "@/server/services/brain/feedback";
import { addManualEntry, archiveEntry, confirmEntry, createTrialRule, promoteToAgency, restoreEntry, TRIAL_LIMIT } from "@/server/services/brain/entries";
import { runMaintenance } from "@/server/services/brain/maintenance";
import { buildContext } from "@/server/services/context/build-context";
import { createGeneration, runGeneration } from "@/server/services/generation/pipeline";
import { MockLLMProvider, mockInterpretFeedback } from "@/server/providers/llm/mock";
import { MockImageProvider } from "@/server/providers/image/mock";
import { briefSchema } from "@/lib/types";
import { USER_IDS } from "@/server/db/seed-data";

const llm = new MockLLMProvider();

async function setup() {
  const db = await testDb();
  const [client] = await db.select().from(clients).where(eq(clients.slug, "demo-beauty-salon"));
  const [project] = await db.select().from(projects).where(eq(projects.clientId, client!.id));
  const gen = await createGeneration(db, { clientId: client!.id, projectId: project!.id, userId: USER_IDS.onisim, brief: briefSchema.parse({ message: "Reducere 40% la epilare", variantCount: 1 }) });
  await runGeneration(db, gen.id, { llm, image: new MockImageProvider([0, 0]) });
  const [variant] = await db.select().from(variants).where(eq(variants.generationId, gen.id));
  return { db, client: client!, project: project!, variant: variant! };
}

async function snapshotIds(db: DB, clientId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  const fmts = await db.select().from(formats);
  const { snapshot } = await buildContext(db, { client: client!, styleId: null, formats: fmts, brief: { message: "x", cta: "", notes: "", formats: ["feed_4x5", "story_9x16"], angles: [] }, markUsed: false });
  return snapshot;
}

describe("mock feedback interpretation", () => {
  it("sentences with nu / evită / mereu become rules; the rest is one-off", () => {
    const r = mockInterpretFeedback({
      comment: "Textul e prea mic pe story și nu mai folosi poze cu femei în costum de baie la clientul ăsta.",
      variant: { headline: "h", cta: "c", style: null, format: "feed_4x5" },
      existingRules: [],
      availableFormats: ["feed_4x5", "story_9x16"],
      availableStyles: [],
    });
    expect(r.rules).toHaveLength(1);
    expect(r.rules[0]!.text).toMatch(/^Nu mai folosi poze/);
    expect(r.oneOff?.instruction).toContain("prea mic pe story");
    expect(r.summary).toMatch(/^Am înțeles 2 lucruri/);
  });
});

describe("feedback → brain", () => {
  it("creates a trial rule with source; the same idea twice promotes it to active", async () => {
    const { db, client, variant } = await setup();
    const r1 = await submitFeedback(db, { variantId: variant.id, authorId: USER_IDS.onisim, text: "Nu folosi roz neon la clientul ăsta.", llm });
    expect(r1.created).toHaveLength(1);
    const [e1] = await db.select().from(brainEntries).where(eq(brainEntries.id, r1.created[0]!.id));
    expect(e1!.status).toBe("trial");
    expect(e1!.createdBy).toBe("ai");
    expect(e1!.source?.quote).toBe("Nu folosi roz neon la clientul ăsta.");
    expect(e1!.source?.authorName).toBe("Onisim");
    expect(e1!.source?.variantId).toBe(variant.id);
    const [fb] = await db.select().from(feedback).where(eq(feedback.id, r1.feedbackId));
    expect(fb!.createdBrainEntryIds).toEqual([e1!.id]);

    let snap = await snapshotIds(db, client.id);
    expect(snap.trialRules.map((r) => r.id)).toContain(e1!.id);

    // first match → confirmations 1 (still trial), second → promoted
    await submitFeedback(db, { variantId: variant.id, authorId: USER_IDS.andrei, text: "Nu folosi roz neon la clientul ăsta!", llm });
    let [e] = await db.select().from(brainEntries).where(eq(brainEntries.id, e1!.id));
    expect(e!.confirmations).toBe(1);
    expect(e!.status).toBe("trial");
    await submitFeedback(db, { variantId: variant.id, authorId: USER_IDS.andrei, text: "Nu folosi roz neon la clientul ăsta, vă rog.", llm });
    [e] = await db.select().from(brainEntries).where(eq(brainEntries.id, e1!.id));
    expect(e!.confirmations).toBe(2);
    expect(e!.status).toBe("active");
    const evs = await db.select().from(brainEntryEvents).where(eq(brainEntryEvents.entryId, e1!.id));
    expect(evs.map((x) => x.type)).toEqual(expect.arrayContaining(["created", "confirmed", "promoted"]));
    // no duplicate rule was created
    const all = await db.select().from(brainEntries).where(eq(brainEntries.clientId, client.id));
    expect(all.filter((x) => x.text.toLowerCase().includes("roz neon"))).toHaveLength(1);

    snap = await snapshotIds(db, client.id);
    expect(snap.clientRules.map((r) => r.id)).toContain(e1!.id);
  });

  it("Confirmă promotes immediately; archived rules leave the context; restore brings them back", async () => {
    const { db, client, variant } = await setup();
    const r = await submitFeedback(db, { variantId: variant.id, authorId: USER_IDS.onisim, text: "Evită fundalurile negre.", llm });
    const id = r.created[0]!.id;
    await confirmEntry(db, id, USER_IDS.onisim);
    expect((await snapshotIds(db, client.id)).clientRules.map((x) => x.id)).toContain(id);
    await archiveEntry(db, id, USER_IDS.onisim);
    expect((await snapshotIds(db, client.id)).usedEntryIds).not.toContain(id);
    await restoreEntry(db, id, USER_IDS.onisim);
    expect((await snapshotIds(db, client.id)).usedEntryIds).toContain(id);
  });

  it("keeps at most 15 trial rules: the oldest unconfirmed is archived", async () => {
    const { db, client } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < TRIAL_LIMIT + 2; i++) {
      const e = await createTrialRule(db, { clientId: client.id, text: `Regula numărul ${i}`, scope: {}, source: {}, suggestAgencyWide: false });
      ids.push(e.id);
    }
    const trials = await db.select().from(brainEntries).where(and(eq(brainEntries.clientId, client.id), eq(brainEntries.status, "trial")));
    expect(trials).toHaveLength(TRIAL_LIMIT);
    const [first] = await db.select().from(brainEntries).where(eq(brainEntries.id, ids[0]!));
    expect(first!.status).toBe("archived");
  });

  it("archives trial rules unconfirmed and unused for 30 days", async () => {
    const { db, client } = await setup();
    const e = await createTrialRule(db, { clientId: client.id, text: "Regulă veche", scope: {}, source: {}, suggestAgencyWide: false });
    await db.update(brainEntries).set({ createdAt: new Date(Date.now() - 31 * 864e5) }).where(eq(brainEntries.id, e.id));
    expect(await runMaintenance(db)).toBeGreaterThanOrEqual(1);
    const [after] = await db.select().from(brainEntries).where(eq(brainEntries.id, e.id));
    expect(after!.status).toBe("archived");
  });

  it("manual rules are active; agency promotion creates a clientId=null rule", async () => {
    const { db, client } = await setup();
    const m = await addManualEntry(db, { clientId: client.id, text: "Logo mereu sus.", authorId: USER_IDS.onisim, authorName: "Onisim" });
    expect(m.status).toBe("active");
    expect(m.createdBy).toBe("user");
    const agency = await promoteToAgency(db, m.id, USER_IDS.onisim);
    expect(agency.clientId).toBeNull();
    const agencyRules = await db.select().from(brainEntries).where(isNull(brainEntries.clientId));
    expect(agencyRules.some((r) => r.text === "Logo mereu sus.")).toBe(true);
    expect((await snapshotIds(db, client.id)).agencyRules.map((r) => r.id)).toContain(agency.id);
  });
});
