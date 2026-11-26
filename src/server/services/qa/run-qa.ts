import { eq, inArray, and, sql, isNull, or } from "drizzle-orm";
import type { DB } from "../../db/connect";
import { brainEntries, brandAssets, clients, formats, styleVersions, variants } from "../../db/schema";
import type { QaIssue, QaResult } from "@/lib/types";
import type { VariantDocument } from "@/lib/template-types";
import { normalizeDeep, normalizeDiacritics } from "@/lib/diacritics";
import { approxMeasure } from "@/lib/text-fit";
import { fitTextLayer } from "@/lib/resolve";
import type { RGB } from "@/lib/colors";
import { checkContrast, checkLogo, checkMinFont, checkOverflow, checkSafeZone, findCedillas, summarize } from "./checks";
import { getLLM } from "../../providers";
import { loggedCall } from "../llm-log";

async function previewSampler(png: Buffer, doc: VariantDocument) {
  const { default: sharp } = await import("sharp");
  const img = sharp(png);
  const meta = await img.metadata();
  const W = meta.width ?? doc.width;
  const H = meta.height ?? doc.height;
  const sx = W / doc.width;
  const sy = H / doc.height;
  const raw = await img.removeAlpha().raw().toBuffer();
  return (r: { x: number; y: number; w: number; h: number }): RGB | null => {
    const x0 = Math.max(0, Math.floor(r.x * sx));
    const y0 = Math.max(0, Math.floor(r.y * sy));
    const x1 = Math.min(W, Math.ceil((r.x + r.w) * sx));
    const y1 = Math.min(H, Math.ceil((r.y + r.h) * sy));
    if (x1 <= x0 || y1 <= y0) return null;
    let n = 0;
    const acc: RGB = [0, 0, 0];
    const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)));
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = (y * W + x) * 3;
        acc[0] += raw[i]!;
        acc[1] += raw[i + 1]!;
        acc[2] += raw[i + 2]!;
        n++;
      }
    }
    return n ? [acc[0] / n, acc[1] / n, acc[2] / n] : null;
  };
}

/**
 * Deterministic QA on every format document (+ vision check on the master preview when Claude is configured).
 * Auto-fixes cedilla diacritics in documents/copy and records it.
 */
export async function runQa(db: DB, variantId: string, opts: { previewPng?: Buffer; overflowByFormat?: Record<string, string[]>; vision?: boolean } = {}): Promise<QaResult> {
  const [v] = await db.select().from(variants).where(eq(variants.id, variantId));
  if (!v) throw new Error("Variantă inexistentă");
  const [client] = await db.select().from(clients).where(eq(clients.id, v.clientId));
  const fmts = await db.select().from(formats).where(inArray(formats.key, Object.keys(v.documents)));
  const logo = await db.select({ id: brandAssets.id }).from(brandAssets).where(and(eq(brandAssets.clientId, v.clientId), inArray(brandAssets.type, ["logo", "logo_light"])));
  const issues: QaIssue[] = [];

  // diacritics: fix everywhere, note it
  let documents = v.documents;
  const cedillaLayers = Object.values(documents).flatMap((d) => findCedillas(d));
  const copyHasCedilla = JSON.stringify(v.copy) !== JSON.stringify(normalizeDeep(v.copy));
  if (cedillaLayers.length || copyHasCedilla) {
    documents = normalizeDeep(documents);
    await db.update(variants).set({ documents, copy: normalizeDeep(v.copy) }).where(eq(variants.id, v.id));
    issues.push({ code: "diacritics", severity: "warning", message: "Am corectat automat ş/ţ (sedilă) în ș/ț (virgulă)." });
  }

  for (const doc of Object.values(documents)) {
    const f = fmts.find((x) => x.key === doc.formatKey);
    if (f) issues.push(...checkSafeZone(doc, f.safeZone));
    // overflow: browser-reported for rendered formats, approximate for the others
    const reported = opts.overflowByFormat?.[doc.formatKey];
    const overflowIds =
      reported ??
      doc.layers.filter((l) => l.type === "text").filter((l) => l.type === "text" && fitTextLayer(l.autoFit ? l : { ...l, maxSize: l.fontSize, minSize: l.fontSize }, approxMeasure).overflow).map((l) => l.id);
    issues.push(...checkOverflow(doc, overflowIds));
    issues.push(...checkMinFont(doc));
    issues.push(...checkLogo(doc, logo.length > 0));
  }

  const master = documents[v.masterFormatKey];
  if (opts.previewPng && master) {
    const sample = await previewSampler(opts.previewPng, master);
    issues.push(...checkContrast(master, sample));
  }

  // vision (Claude when configured, mock otherwise)
  let vision: QaResult["vision"] = "skipped";
  if (opts.previewPng && opts.vision !== false && client) {
    const llm = getLLM();
    const rules = await db
      .select({ text: brainEntries.text })
      .from(brainEntries)
      .where(and(or(isNull(brainEntries.clientId), eq(brainEntries.clientId, client.id)), sql`${brainEntries.status} <> 'archived'`));
    const [sv] = v.styleVersionId ? await db.select().from(styleVersions).where(eq(styleVersions.id, v.styleVersionId)) : [];
    try {
      const { result } = await loggedCall(
        db,
        { purpose: "qa_vision", provider: llm.id, model: llm.model, generationId: v.generationId, clientId: client.id },
        () =>
          llm.reviewImage({
            image: { data: opts.previewPng!, mimeType: "image/png" },
            expectedCopy: { headline: v.copy.headline, subheadline: v.copy.subheadline, cta: v.copy.cta },
            rules: rules.map((r) => r.text),
            industry: client.industry,
            textMode: sv?.textMode ?? "overlay",
          }),
        (r) => ({ ...r.usage, model: r.model, promptVersion: r.promptVersion }),
      );
      issues.push(...result.data.issues.map((i) => ({ code: "vision" as const, severity: i.severity, message: normalizeDiacritics(i.message), formatKey: v.masterFormatKey })));
      vision = llm.id === "mock" ? "mock" : "done";
    } catch {
      vision = "error";
    }
  }

  const qa = summarize(issues, vision);
  await db.update(variants).set({ qa }).where(eq(variants.id, v.id));
  return qa;
}
