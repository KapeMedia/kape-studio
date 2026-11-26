import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers";
import type { DB } from "@/server/db/connect";
import { brainEntries, clients, formats, generations, llmCalls, projects, references, variants } from "@/server/db/schema";
import { assembleContext, buildContext, scopeMatches } from "@/server/services/context/build-context";
import { chooseStyle, createGeneration, runGeneration } from "@/server/services/generation/pipeline";
import { setVariantStatus } from "@/server/services/review";
import { MockLLMProvider, extractOfferFacts, mockAngles } from "@/server/providers/llm/mock";
import { MockImageProvider } from "@/server/providers/image/mock";
import { briefSchema } from "@/lib/types";

const deps = { llm: new MockLLMProvider(), image: new MockImageProvider([0, 0]) };

describe("context builder", () => {
  let db: DB;
  beforeAll(async () => {
    db = await testDb();
  });

  it("scope matching: empty = everywhere; formats/styles filter", () => {
    const style = { id: "s1", slug: "oferta-clara", name: "Ofertă clară" };
    expect(scopeMatches({}, ["feed_4x5"], style)).toBe(true);
    expect(scopeMatches({ formats: ["story_9x16"] }, ["feed_4x5"], style)).toBe(false);
    expect(scopeMatches({ formats: ["story_9x16"] }, ["feed_4x5", "story_9x16"], style)).toBe(true);
    expect(scopeMatches({ styles: ["oferta-clara"] }, ["feed_4x5"], style)).toBe(true);
    expect(scopeMatches({ styles: ["testimonial"] }, ["feed_4x5"], style)).toBe(false);
  });

  it("orders sections, includes active + trial rules, excludes archived, marks used entries", async () => {
    const [client] = await db.select().from(clients).where(eq(clients.slug, "demo-beauty-salon"));
    const ins = async (text: string, status: "active" | "trial" | "archived", scope = {}) =>
      (await db.insert(brainEntries).values({ clientId: client!.id, text, status, scope, source: { quote: "citat", authorName: "Onisim", date: "2026-11-26" } }).returning())[0]!;
    const active = await ins("Nu folosi roz neon.", "active");
    const trial = await ins("Pe story, headline-ul minim 90 px.", "trial", { formats: ["story_9x16"] });
    const archived = await ins("Regulă veche arhivată.", "archived");
    const otherFormat = await ins("Doar pe cover.", "active", { formats: ["fb_cover"] });
    const fmts = await db.select().from(formats);
    const { snapshot } = await buildContext(db, {
      client: client!,
      styleId: null,
      formats: fmts.filter((f) => ["feed_4x5", "story_9x16"].includes(f.key)),
      brief: { message: "Reducere 40%", cta: "", notes: "", formats: ["feed_4x5", "story_9x16"], angles: [] },
    });
    expect(snapshot.clientRules.map((r) => r.id)).toContain(active.id);
    expect(snapshot.trialRules.map((r) => r.id)).toContain(trial.id);
    expect(snapshot.usedEntryIds).not.toContain(archived.id);
    expect(snapshot.usedEntryIds).not.toContain(otherFormat.id);
    expect(snapshot.agencyRules.length).toBeGreaterThan(0);
    expect(snapshot.formatInstructions.map((f) => f.key)).toEqual(["feed_4x5", "story_9x16"]);
    const p = snapshot.prompt;
    const order = ["# ROL", "1. Reguli de agenție", "2. Instrucțiuni de format", "3. Stil", "4. Client", "5. Reguli fixe", "6. Reguli în probă", "8. Brief", "9. Prioritate"].map((s) => p.indexOf(s));
    expect(order.every((x) => x >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(p).toContain("«citat»");
    const [after] = await db.select().from(brainEntries).where(eq(brainEntries.id, active.id));
    expect(after!.uses).toBe(1);
    expect(after!.lastUsedAt).not.toBeNull();
  });

  it("assembleContext is pure and pinned rules come first", () => {
    const now = new Date("2026-11-26T10:00:00Z");
    const base = { clientId: "c", kind: "rule" as const, status: "active" as const, scope: {}, confirmations: 0, uses: 0, lastUsedAt: null, source: null, createdBy: "user" as const, suggestAgencyWide: false, updatedAt: now };
    const snap = assembleContext({
      client: { id: "c", name: "X", slug: "x", industry: "food", description: "", audience: "", tone: "", dos: "", donts: "", activeOffers: "", colors: [], archivedAt: null, createdAt: now, updatedAt: now },
      style: null,
      formats: [],
      brief: { message: "m", cta: "", notes: "", formats: ["feed_4x5"], angles: [] },
      agencyRules: [],
      clientEntries: [
        { ...base, id: "a", text: "A", pinned: false, createdAt: new Date("2026-11-25") },
        { ...base, id: "b", text: "B", pinned: true, createdAt: new Date("2026-11-01") },
      ],
      examples: [],
      now,
    });
    expect(snap.clientRules.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("generation pipeline (mock)", () => {
  it("generates 4 variants with copy, background and documents per format; logs llm_calls at $0", async () => {
    const db = await testDb();
    const [client] = await db.select().from(clients).where(eq(clients.slug, "demo-smash-burgers"));
    const [project] = await db.select().from(projects).where(eq(projects.clientId, client!.id));
    const brief = briefSchema.parse({ message: "Meniu Double Smash cu cartofi la 39 lei, doar până pe 30 noiembrie", formats: ["feed_4x5", "story_9x16"], variantCount: 4 });
    const gen = await createGeneration(db, { clientId: client!.id, projectId: project!.id, userId: null, brief });
    await runGeneration(db, gen.id, deps);
    const [g] = await db.select().from(generations).where(eq(generations.id, gen.id));
    expect(g!.status).toBe("done");
    expect(g!.contextSnapshot?.prompt).toContain("Demo Smash Burgers");
    const vs = await db.select().from(variants).where(eq(variants.generationId, gen.id));
    expect(vs).toHaveLength(4);
    for (const v of vs) {
      expect(v.status).toBe("draft");
      expect(v.backgroundAssetKey).toBeTruthy();
      expect(Object.keys(v.documents).sort()).toEqual(["feed_4x5", "story_9x16"]);
      const headline = v.documents.feed_4x5!.layers.find((l) => l.type === "text" && l.role === "headline");
      expect(headline).toBeTruthy();
    }
    const calls = await db.select().from(llmCalls).where(eq(llmCalls.generationId, gen.id));
    expect(calls.filter((c) => c.purpose === "copy")).toHaveLength(1);
    expect(calls.filter((c) => c.purpose === "image")).toHaveLength(4);
    expect(calls.every((c) => c.costUsd === 0)).toBe(true);

    // review: approve one, reject one → references for context step 8
    await setVariantStatus(db, vs[0]!.id, "approved");
    await setVariantStatus(db, vs[1]!.id, "rejected", "Prea aglomerat");
    const refs = await db.select().from(references).where(eq(references.clientId, client!.id));
    expect(refs.map((r) => r.kind).sort()).toEqual(["approved_example", "rejected_example"]);
    const fmts = await db.select().from(formats);
    const { snapshot } = await buildContext(db, { client: client!, styleId: null, formats: fmts, brief: { message: "x", cta: "", notes: "", formats: ["feed_4x5"], angles: [] }, markUsed: false });
    expect(snapshot.examples.find((e) => e.kind === "rejected")?.reason).toBe("Prea aglomerat");
  });

  it("marks the generation failed when the LLM fails", async () => {
    const db = await testDb();
    const [client] = await db.select().from(clients).where(eq(clients.slug, "demo-smash-burgers"));
    const [project] = await db.select().from(projects).where(eq(projects.clientId, client!.id));
    const gen = await createGeneration(db, { clientId: client!.id, projectId: project!.id, userId: null, brief: briefSchema.parse({ message: "Test eșec" }) });
    const broken = new MockLLMProvider();
    broken.writeCopy = async () => {
      throw new Error("boom");
    };
    await runGeneration(db, gen.id, { llm: broken, image: deps.image });
    const [g] = await db.select().from(generations).where(eq(generations.id, gen.id));
    expect(g!.status).toBe("failed");
    expect(g!.error).toBe("boom");
    const calls = await db.select().from(llmCalls).where(eq(llmCalls.generationId, gen.id));
    expect(calls[0]!.ok).toBe(false);
  });
});

describe("mock providers", () => {
  it("extracts offer facts from a Romanian brief", () => {
    const f = extractOfferFacts("Reducere 40% la epilare definitivă zona inghinală, doar până pe 30 noiembrie, CTA programează-te");
    expect(f.percent).toBe("-40%");
    expect(f.date).toBe("30 noiembrie");
    expect(f.cta).toBe("programează-te");
    expect(f.topic).toBe("epilare definitivă zona inghinală");
  });
  it("proposes 4 distinct angles deterministically", () => {
    const a = mockAngles({ message: "Reducere 40% la epilare definitivă", cta: "" }, "beauty");
    expect(a).toHaveLength(4);
    expect(new Set(a.map((x) => x.type)).size).toBe(4);
    expect(mockAngles({ message: "Reducere 40% la epilare definitivă", cta: "" }, "beauty")).toEqual(a);
  });
  it("chooses a style for „Alege tu”", () => {
    const list = [{ slug: "oferta-clara" }, { slug: "produs-fundal-colorat" }, { slug: "minimal-premium" }, { slug: "foto-full-gradient" }];
    expect(chooseStyle(list, "beauty", "Reducere 40%")!.slug).toBe("oferta-clara");
    expect(chooseStyle(list, "food", "Burger nou")!.slug).toBe("produs-fundal-colorat");
  });
});
