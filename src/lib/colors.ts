import type { BrandColor } from "./types";
import type { BrandRole } from "./template-types";

export const FALLBACK_COLORS: Record<BrandRole, string> = {
  primary: "#4F46E5",
  secondary: "#E0E7FF",
  accent: "#F59E0B",
  background: "#FFFFFF",
  text: "#111827",
};

export type Palette = Record<BrandRole, string>;

export function paletteFromColors(colors: BrandColor[]): Palette {
  const out = { ...FALLBACK_COLORS };
  const seen = new Set<string>();
  for (const c of colors) {
    if (!seen.has(c.role)) {
      out[c.role] = c.hex.toUpperCase();
      seen.add(c.role);
    }
  }
  return out;
}

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function isDark(hex: string): boolean {
  return relativeLuminance(hexToRgb(hex)) < 0.4;
}

/** Blend `top` over `bottom` with alpha. */
export function blend(top: RGB, bottom: RGB, alpha: number): RGB {
  return [
    top[0] * alpha + bottom[0] * (1 - alpha),
    top[1] * alpha + bottom[1] * (1 - alpha),
    top[2] * alpha + bottom[2] * (1 - alpha),
  ];
}
