import type { DocLayer, VariantDocument } from "@/lib/template-types";
import type { QaIssue, QaResult, QaSeverity, SafeZone } from "@/lib/types";
import { contrastRatio, hexToRgb, type RGB } from "@/lib/colors";
import { hasCedillaDiacritics } from "@/lib/diacritics";

const ROLE_LABEL: Record<string, string> = {
  headline: "Headline-ul",
  subheadline: "Subheadline-ul",
  cta: "CTA-ul",
  price: "Prețul",
  badge: "Badge-ul",
  body: "Textul",
};
const label = (l: DocLayer) => (l.type === "logo" ? "Logo-ul" : l.type === "text" ? (ROLE_LABEL[l.role] ?? "Textul") : "Layerul");

/** Text/logo boxes must sit inside the safe zone and outside avoidRects. 2px tolerance. */
export function checkSafeZone(doc: VariantDocument, sz: SafeZone): QaIssue[] {
  const issues: QaIssue[] = [];
  const t = 2;
  for (const l of doc.layers) {
    if (l.type !== "text" && l.type !== "logo") continue;
    const out = l.x < sz.left - t || l.y < sz.top - t || l.x + l.w > doc.width - sz.right + t || l.y + l.h > doc.height - sz.bottom + t;
    if (out) {
      issues.push({ code: "safe_zone", severity: "error", message: `${label(l)} iese din safe zone (${doc.formatKey}).`, formatKey: doc.formatKey, layerId: l.id });
      continue;
    }
    for (const r of sz.avoidRects ?? []) {
      const overlap = l.x < r.x + r.w && l.x + l.w > r.x && l.y < r.y + r.h && l.y + l.h > r.y;
      if (overlap) {
        issues.push({ code: "safe_zone", severity: "error", message: `${label(l)} intră în zona acoperită (ex: poza de profil) pe ${doc.formatKey}.`, formatKey: doc.formatKey, layerId: l.id });
        break;
      }
    }
  }
  return issues;
}

/** Text under 28px at 1080 width (40px on story) → warning. */
export function checkMinFont(doc: VariantDocument, fontSizes: Record<string, number> = {}): QaIssue[] {
  const story = doc.height / doc.width > 1.5;
  const min = story ? 40 : 28;
  const scale = 1080 / doc.width;
  const issues: QaIssue[] = [];
  for (const l of doc.layers) {
    if (l.type !== "text") continue;
    const size = (fontSizes[l.id] ?? l.fontSize) * scale;
    if (size < min - 0.5) {
      issues.push({ code: "min_font", severity: "warning", message: `${label(l)} are ${Math.round(size)} px (minim recomandat ${min} px${story ? " pe story" : ""}).`, formatKey: doc.formatKey, layerId: l.id });
    }
  }
  return issues;
}

export function checkLogo(doc: VariantDocument, clientHasLogo: boolean): QaIssue[] {
  if (!clientHasLogo || doc.layers.some((l) => l.type === "logo")) return [];
  return [{ code: "logo_present", severity: "warning", message: `Clientul are logo, dar bannerul ${doc.formatKey} nu îl conține.`, formatKey: doc.formatKey }];
}

export function checkOverflow(doc: VariantDocument, overflowIds: string[]): QaIssue[] {
  return doc.layers
    .filter((l) => l.type === "text" && overflowIds.includes(l.id))
    .map((l) => ({ code: "text_overflow" as const, severity: "error" as const, message: `${label(l)} nu încape în casetă nici la mărimea minimă (${doc.formatKey}).`, formatKey: doc.formatKey, layerId: l.id }));
}

/**
 * WCAG contrast between text colour and the average colour behind it (sampled from the preview).
 * Text with its own background (buttons, badges) is checked against that fill.
 */
export function checkContrast(doc: VariantDocument, sample: (rect: { x: number; y: number; w: number; h: number }) => RGB | null): QaIssue[] {
  const issues: QaIssue[] = [];
  for (const l of doc.layers) {
    if (l.type !== "text") continue;
    const behind = l.background ? hexToRgb(l.background.fill) : sample({ x: l.x, y: l.y, w: l.w, h: l.h });
    if (!behind) continue;
    const ratio = contrastRatio(hexToRgb(l.color), behind);
    if (ratio < 3) {
      issues.push({ code: "contrast", severity: "warning", message: `${label(l)} are contrast slab (${ratio.toFixed(1)}:1, minim 3:1).`, formatKey: doc.formatKey, layerId: l.id });
    }
  }
  return issues;
}

export function findCedillas(doc: VariantDocument): string[] {
  return doc.layers.filter((l): l is Extract<DocLayer, { type: "text" }> => l.type === "text" && hasCedillaDiacritics(l.text)).map((l) => l.id);
}

export function summarize(issues: QaIssue[], vision: QaResult["vision"]): QaResult {
  const status: QaSeverity = issues.some((i) => i.severity === "error") ? "error" : issues.length ? "warning" : "ok";
  return { status, issues, checkedAt: new Date().toISOString(), vision };
}
