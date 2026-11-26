import { describe, expect, it } from "vitest";
import { createHistory, push, redo, replace, undo } from "@/editor/history";
import { exportFileName } from "@/lib/export-names";
import { copyFromDocument } from "@/server/services/editor";
import { carryOverEdits, resolveDocument } from "@/lib/resolve";
import { paletteFromColors } from "@/lib/colors";
import { SEED_FORMATS, SEED_STYLES } from "@/server/db/seed-data";

describe("undo/redo history", () => {
  it("supports at least 20 undo steps and redo", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 25; i++) h = push(h, i);
    for (let i = 0; i < 20; i++) h = undo(h);
    expect(h.present).toBe(5);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe(7);
    h = push(h, 100);
    expect(h.future).toEqual([]);
  });
  it("replace merges continuous typing into one step", () => {
    let h = createHistory("a");
    h = push(h, "ab");
    h = replace(h, "abc");
    h = replace(h, "abcd");
    expect(undo(h).present).toBe("a");
  });
  it("caps history at the limit", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 100; i++) h = push(h, i, 30);
    expect(h.past).toHaveLength(30);
  });
});

describe("export", () => {
  it("names files client_proiect_stil_format_v{index}.png", () => {
    expect(exportFileName({ client: "Epil Point", project: "Black Friday 2026", style: "Ofertă clară", format: "story_9x16", index: 2 })).toBe(
      "epil-point_black-friday-2026_oferta-clara_story_9x16_v2.png",
    );
  });
});

describe("format switching", () => {
  const palette = paletteFromColors([]);
  const def = SEED_STYLES[0]!.template.definition;
  const base = { templateId: "t", definition: def, palette, fonts: { heading: "Inter", body: "Inter" }, assets: { background: "bg", logo: null, logoLight: null } };
  it("carries text and colour edits from the master to a derived format", () => {
    const master = resolveDocument({ ...base, format: SEED_FORMATS[0]!, copy: { headline: "Vechi", cta: "Sună" } });
    const edited = { ...master, layers: master.layers.map((l) => (l.type === "text" && l.role === "headline" ? { ...l, text: "Titlu editat", color: "#123456" } : l)) };
    const square = carryOverEdits(edited, resolveDocument({ ...base, format: SEED_FORMATS[1]!, copy: { headline: "Vechi", cta: "Sună" } }));
    const h = square.layers.find((l) => l.type === "text" && l.role === "headline");
    expect(h?.type === "text" && h.text).toBe("Titlu editat");
    expect(h?.type === "text" && h.color).toBe("#123456");
    expect(square.height).toBe(1080);
  });
  it("syncs variant copy from the master document text", () => {
    const master = resolveDocument({ ...base, format: SEED_FORMATS[0]!, copy: { headline: "H", subheadline: "S", cta: "C", extra: { price: "-10%" } } });
    const doc = { ...master, layers: master.layers.map((l) => (l.type === "text" && l.role === "cta" ? { ...l, text: "Programează-te" } : l)) };
    expect(copyFromDocument(doc, { headline: "H", cta: "C" }).cta).toBe("Programează-te");
  });
});
