import { describe, expect, it } from "vitest";
import { hasCedillaDiacritics, normalizeDeep, normalizeDiacritics } from "@/lib/diacritics";

describe("diacritics", () => {
  it("converts cedilla ş/ţ to comma-below ș/ț", () => {
    expect(normalizeDiacritics("Reducere şi ţânţari ŞŢ")).toBe("Reducere și țânțari ȘȚ");
  });
  it("detects cedilla forms", () => {
    expect(hasCedillaDiacritics("şcoală")).toBe(true);
    expect(hasCedillaDiacritics("școală")).toBe(false);
  });
  it("normalises nested objects", () => {
    expect(normalizeDeep({ a: ["ţ"], b: { c: "ş" }, n: 3 })).toEqual({ a: ["ț"], b: { c: "ș" }, n: 3 });
  });
});
