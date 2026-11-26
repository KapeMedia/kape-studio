import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { checkContrast, checkLogo, checkMinFont, checkOverflow, checkSafeZone, summarize } from "@/server/services/qa/checks";
import { runQa } from "@/server/services/qa/run-qa";
import { contrastRatio } from "@/lib/colors";
import type { VariantDocument, DocTextLayer } from "@/lib/template-types";
import { SEED_FORMATS } from "@/server/db/seed-data";
import { testDb } from "./helpers";
import { clients, projects, variants } from "@/server/db/schema";
import { createGeneration, runGeneration } from "@/server/services/generation/pipeline";
import { MockLLMProvider } from "@/server/providers/llm/mock";
import { MockImageProvider } from "@/server/providers/image/mock";
import { briefSchema } from "@/lib/types";

const story = SEED_FORMATS.find((f) => f.key === "story_9x16")!;

function text(over: Partial<DocTextLayer>): DocTextLayer {
  return {
    id: "headline", type: "text", role: "headline", text: "Salut", fontRole: "heading", fontFamily: "Inter", weight: 700, fontSize: 80, maxSize: 80, minSize: 40,
    autoFit: true, align: "left", color: "#FFFFFF", uppercase: false, lineHeight: 1.1, x: 100, y: 800, w: 800, h: 200, ...over,
  };
}
function doc(layers: VariantDocument["layers"], key = "story_9x16", w = 1080, h = 1920): VariantDocument {
  return { templateId: "t", formatKey: key as VariantDocument["formatKey"], width: w, height: h, background: "#000000", layers };
}

describe("deterministic QA", () => {
  it("story text outside the safe zone → error", () => {
    const issues = checkSafeZone(doc([text({ y: 100 })]), story.safeZone);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
    expect(summarize(issues, "skipped").status).toBe("error");
    expect(checkSafeZone(doc([text({ y: 800 })]), story.safeZone)).toHaveLength(0);
  });
  it("avoidRects (FB cover profile picture) are flagged", () => {
    const cover = SEED_FORMATS.find((f) => f.key === "fb_cover")!;
    const issues = checkSafeZone(doc([text({ x: 200, y: 420, w: 300, h: 100 })], "fb_cover", 1640, 624), cover.safeZone);
    expect(issues[0]?.message).toContain("zona acoperită");
  });
  it("min font: < 40px on story, < 28px on feed → warning", () => {
    expect(checkMinFont(doc([text({ fontSize: 36 })]))).toHaveLength(1);
    expect(checkMinFont(doc([text({ fontSize: 36 })], "feed_4x5", 1080, 1350))).toHaveLength(0);
    expect(checkMinFont(doc([text({ fontSize: 24 })], "feed_4x5", 1080, 1350))).toHaveLength(1);
  });
  it("logo missing when the client has one → warning", () => {
    expect(checkLogo(doc([]), true)).toHaveLength(1);
    expect(checkLogo(doc([]), false)).toHaveLength(0);
  });
  it("overflow ids → error", () => {
    expect(checkOverflow(doc([text({})]), ["headline"])[0]!.code).toBe("text_overflow");
  });
  it("contrast below 3:1 → warning (text vs. sampled background, or vs. its button fill)", () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 0);
    expect(checkContrast(doc([text({ color: "#FFFFFF" })]), () => [240, 240, 240])).toHaveLength(1);
    expect(checkContrast(doc([text({ color: "#FFFFFF" })]), () => [20, 20, 20])).toHaveLength(0);
    expect(checkContrast(doc([text({ color: "#2B2024", background: { fill: "#A8456B", paddingX: 10, paddingY: 10, radius: 4 } })]), () => null)).toHaveLength(1);
  });
});

describe("runQa on a variant", () => {
  it("fixes cedilla diacritics, flags a story headline moved out of the safe zone, samples contrast from the preview", async () => {
    const db = await testDb();
    const [client] = await db.select().from(clients).where(eq(clients.slug, "demo-beauty-salon"));
    const [project] = await db.select().from(projects).where(eq(projects.clientId, client!.id));
    const gen = await createGeneration(db, { clientId: client!.id, projectId: project!.id, userId: null, brief: briefSchema.parse({ message: "Reducere 40% la epilare", formats: ["feed_4x5", "story_9x16"], variantCount: 1 }) });
    await runGeneration(db, gen.id, { llm: new MockLLMProvider(), image: new MockImageProvider([0, 0]) });
    const [v] = await db.select().from(variants).where(eq(variants.generationId, gen.id));
    const docs = structuredClone(v!.documents);
    docs.story_9x16!.layers = docs.story_9x16!.layers.map((l) => (l.type === "text" && l.role === "headline" ? { ...l, y: 40, text: "Ofertă şi reducere" } : l));
    await db.update(variants).set({ documents: docs }).where(eq(variants.id, v!.id));
    const png = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const qa = await runQa(db, v!.id, { previewPng: png });
    expect(qa.status).toBe("error");
    expect(qa.issues.some((i) => i.code === "safe_zone" && i.formatKey === "story_9x16")).toBe(true);
    expect(qa.issues.some((i) => i.code === "diacritics")).toBe(true);
    expect(qa.vision).toBe("mock");
    const [after] = await db.select().from(variants).where(eq(variants.id, v!.id));
    const h = after!.documents.story_9x16!.layers.find((l) => l.type === "text" && l.role === "headline");
    expect(h?.type === "text" && h.text).toBe("Ofertă și reducere");
    expect(after!.qa?.status).toBe("error");
  });
});
