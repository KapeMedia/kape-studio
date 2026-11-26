import { describe, expect, it } from "vitest";
import { fitText, wrapWords, type Measurer } from "@/lib/text-fit";
import { getLayout } from "@/lib/derive";
import { resolveDocument } from "@/lib/resolve";
import { paletteFromColors } from "@/lib/colors";
import { SEED_FORMATS, SEED_STYLES, DEMO_CLIENTS } from "@/server/db/seed-data";
import { templateDefinitionSchema } from "@/lib/template-types";
import { checkSafeZone } from "@/server/services/qa/checks";

const mono: Measurer = (t, size) => t.length * size * 0.5;
const fmt = (key: string) => SEED_FORMATS.find((f) => f.key === key)!;

describe("text fitting", () => {
  it("wraps on words without hyphenation", () => {
    expect(wrapWords("Reducere 40% la epilare", 100, 10, mono)).toEqual(["Reducere 40% la", "epilare"]);
  });

  it("keeps maxSize when the text fits", () => {
    const r = fitText({ text: "Salut", width: 500, height: 200, maxSize: 80, minSize: 30, lineHeight: 1.1, measure: mono });
    expect(r.fontSize).toBe(80);
    expect(r.overflow).toBe(false);
  });

  it("shrinks between max and min until it fits", () => {
    const r = fitText({ text: "Reducere 40% la epilare definitivă", width: 400, height: 120, maxSize: 90, minSize: 20, lineHeight: 1, measure: mono });
    expect(r.fontSize).toBeLessThan(90);
    expect(r.fontSize).toBeGreaterThanOrEqual(20);
    expect(r.overflow).toBe(false);
    expect(r.textHeight).toBeLessThanOrEqual(120);
  });

  it("flags overflow when even minSize does not fit", () => {
    const r = fitText({ text: "Un text foarte lung care nu are loc deloc în cutie", width: 100, height: 30, maxSize: 60, minSize: 40, lineHeight: 1.2, measure: mono });
    expect(r.overflow).toBe(true);
    expect(r.fontSize).toBe(40);
  });
});

describe("templates", () => {
  it("all seed templates validate against the schema", () => {
    for (const s of SEED_STYLES) {
      expect(() => templateDefinitionSchema.parse(s.template.definition)).not.toThrow();
    }
  });
});

describe("format derivation", () => {
  const def = SEED_STYLES[0]!.template.definition; // Ofertă clară
  const defNoStory = { layouts: { feed_4x5: def.layouts.feed_4x5! } };

  it("uses explicit layouts when present", () => {
    expect(getLayout(def, fmt("story_9x16"))).toBe(def.layouts.story_9x16);
  });

  it("feed_1x1 keeps image/shape boxes and remaps text into the safe zone", () => {
    const l = getLayout(defNoStory, fmt("feed_1x1"));
    const master = def.layouts.feed_4x5!.layers;
    for (const layer of l.layers.filter((x) => x.type === "image" || x.type === "shape")) {
      expect(layer.box).toEqual(master.find((m) => m.id === layer.id)!.box);
    }
  });

  it("story: text stays in the safe zone, edge layers extend to the canvas edge", () => {
    const f = fmt("story_9x16");
    const l = getLayout(defNoStory, f);
    const top = f.safeZone.top / f.height;
    const bottom = 1 - f.safeZone.bottom / f.height;
    for (const layer of l.layers) {
      if (layer.type === "text" || layer.type === "logo") {
        expect(layer.box.y).toBeGreaterThanOrEqual(top - 0.001);
        expect(layer.box.y + layer.box.h).toBeLessThanOrEqual(bottom + 0.001);
      }
    }
    const photo = l.layers.find((x) => x.id === "photo")!;
    expect(photo.box.y).toBe(0);
    const band = l.layers.find((x) => x.id === "band")!;
    expect(band.box.y + band.box.h).toBeCloseTo(1, 3);
  });

  it("landscape: full image, text in the left half; cover: text centred and clear of the profile picture", () => {
    const land = getLayout(defNoStory, fmt("landscape_191"));
    expect(land.layers.find((x) => x.type === "image")!.box).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    for (const t of land.layers.filter((x) => x.type === "text")) expect(t.box.x + t.box.w).toBeLessThanOrEqual(0.55);
    expect(land.layers.some((x) => x.type === "shape")).toBe(false);

    const f = fmt("fb_cover");
    const cover = getLayout(defNoStory, f);
    for (const t of cover.layers.filter((x) => x.type === "text" || x.type === "logo")) {
      const x0 = t.box.x * f.width;
      const x1 = (t.box.x + t.box.w) * f.width;
      expect(x0).toBeGreaterThanOrEqual(f.safeZone.left - 1);
      expect(x1).toBeLessThanOrEqual(f.width - f.safeZone.right + 1);
    }
  });
});

describe("safe zones across all seed styles and formats", () => {
  it("text and logo layers stay inside the safe zone (explicit and derived layouts)", () => {
    const palette = paletteFromColors(DEMO_CLIENTS[0]!.colors);
    for (const st of SEED_STYLES) {
      for (const variant of [st.template.definition, { layouts: { feed_4x5: st.template.definition.layouts.feed_4x5! } }]) {
        for (const f of SEED_FORMATS) {
          const doc = resolveDocument({ templateId: "t", definition: variant, format: f, copy: { headline: "Titlu", subheadline: "Sub", cta: "CTA", extra: { price: "-40%", badge: "30 NOV" } }, palette, fonts: { heading: "Inter", body: "Inter" }, assets: { background: "b", logo: "l", logoLight: null } });
          const issues = checkSafeZone(doc, f.safeZone);
          expect(issues.map((i) => `${st.slug}/${f.key}: ${i.message}`)).toEqual([]);
        }
      }
    }
  });
});

describe("resolveDocument", () => {
  const client = DEMO_CLIENTS[0]!;
  const palette = paletteFromColors(client.colors);
  const base = {
    templateId: "t1",
    definition: SEED_STYLES[0]!.template.definition,
    copy: { headline: "Reducere 40% la epilare definitivă", subheadline: "Doar până pe 30 noiembrie", cta: "Programează-te", extra: { price: "-40%" } },
    palette,
    fonts: { heading: "brand-h", body: "Inter" },
    assets: { background: "bg.png", logo: "logo.png", logoLight: null },
  };

  it("resolves absolute boxes, brand colours, text and fonts", () => {
    const doc = resolveDocument({ ...base, format: fmt("feed_4x5") });
    expect(doc.width).toBe(1080);
    const band = doc.layers.find((l) => l.id === "band")!;
    expect(band.type === "shape" && band.fill).toBe(palette.primary);
    expect(band.y).toBeCloseTo(810);
    const headline = doc.layers.find((l) => l.id === "headline")!;
    expect(headline.type === "text" && headline.text).toBe("Reducere 40% la epilare definitivă");
    expect(headline.type === "text" && headline.fontFamily).toBe("brand-h");
    expect(headline.type === "text" && headline.fontSize).toBeLessThanOrEqual(92);
    const logo = doc.layers.find((l) => l.type === "logo")!;
    expect(logo.type === "logo" && logo.src).toBe("logo.png");
  });

  it("omits text layers with empty copy and normalises diacritics", () => {
    const doc = resolveDocument({ ...base, copy: { headline: "Ofertă şi reducere", cta: "Sună" }, format: fmt("feed_4x5") });
    expect(doc.layers.some((l) => l.id === "subheadline")).toBe(false);
    expect(doc.layers.some((l) => l.id === "price")).toBe(false);
    const h = doc.layers.find((l) => l.id === "headline");
    expect(h?.type === "text" && h.text).toBe("Ofertă și reducere");
  });

  it("works for every seed style on every format", () => {
    for (const st of SEED_STYLES) {
      for (const f of SEED_FORMATS) {
        const doc = resolveDocument({ ...base, definition: st.template.definition, format: f });
        expect(doc.layers.length).toBeGreaterThan(1);
        expect(doc.width).toBe(f.width);
      }
    }
  });
});
