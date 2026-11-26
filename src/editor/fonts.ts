"use client";

import { REQUIRED_GLYPHS } from "@/lib/diacritics";

export type FontSource = { family: string; url: string; weight?: number };

const loaded = new Map<string, Promise<void>>();

/** Registers brand fonts with FontFace and waits until they're usable. */
export async function loadFonts(fonts: FontSource[]): Promise<void> {
  if (typeof document === "undefined") return;
  await Promise.all(
    fonts.map((f) => {
      const k = `${f.family}|${f.url}`;
      let p = loaded.get(k);
      if (!p) {
        p = (async () => {
          try {
            const face = new FontFace(f.family, `url(${f.url})`, { weight: "100 900" });
            await face.load();
            document.fonts.add(face);
          } catch (e) {
            console.warn("[fonts] nu am putut încărca", f.family, e);
          }
        })();
        loaded.set(k, p);
      }
      return p;
    }),
  );
  // Inter (UI font) is used as fallback; make sure the weights we render are ready.
  await Promise.all(
    [400, 500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px Inter`, "ĂÂÎȘȚăâîșț").catch(() => [])),
  );
}

/**
 * Detects glyphs missing from a loaded font: if a char renders with the same width
 * under two different fallback stacks, the font has it; otherwise it fell back.
 */
export function detectMissingGlyphs(family: string, chars: string[] = REQUIRED_GLYPHS): string[] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const missing: string[] = [];
  for (const ch of chars) {
    ctx.font = `48px "${family}", monospace`;
    const a = ctx.measureText(ch).width;
    ctx.font = `48px "${family}", serif`;
    const b = ctx.measureText(ch).width;
    if (Math.abs(a - b) > 0.5) missing.push(ch);
  }
  return missing;
}

export const FALLBACK_FONT = "Inter";
