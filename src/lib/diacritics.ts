/**
 * Romanian diacritics normalisation.
 * Cedilla forms (ş U+015F, ţ U+0163, Ş U+015E, Ţ U+0162) → comma-below forms
 * (ș U+0219, ț U+021B, Ș U+0218, Ț U+021A).
 */
const MAP: Record<string, string> = {
  "ş": "ș",
  "ţ": "ț",
  "Ş": "Ș",
  "Ţ": "Ț",
};
const RE = /[şţŞŢ]/g;

export function hasCedillaDiacritics(text: string): boolean {
  return /[şţŞŢ]/.test(text);
}

export function normalizeDiacritics(text: string): string {
  return text.replace(RE, (c) => MAP[c] ?? c);
}

/** Recursively normalises every string inside a JSON-like value. */
export function normalizeDeep<T>(value: T): T {
  if (typeof value === "string") return normalizeDiacritics(value) as T;
  if (Array.isArray(value)) return value.map((v: unknown) => normalizeDeep(v)) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeDeep(v);
    return out as T;
  }
  return value;
}

export const FONT_PREVIEW_TEXT = "Șapte țânțari sâcâitori în grădină: ĂÂÎȘȚ ăâîșț";
export const REQUIRED_GLYPHS = ["ă", "â", "î", "ș", "ț", "Ă", "Â", "Î", "Ș", "Ț"];
