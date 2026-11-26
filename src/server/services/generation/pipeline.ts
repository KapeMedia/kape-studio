import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "../../db/connect";
import { clients, formats as formatsTable, generations, styleVersions, styles, templates, variants, type Client, type Format, type Style, type StyleVersion, type Variant } from "../../db/schema";
import type { BriefInput, VariantCopy } from "@/lib/types";
import type { VariantDocument } from "@/lib/template-types";
import { normalizeDeep, normalizeDiacritics } from "@/lib/diacritics";
import { resolveDocument } from "@/lib/resolve";
import { getLayout } from "@/lib/derive";
import { buildContext } from "../context/build-context";
import { getBrandContext, type BrandContext } from "../brand";
import { loggedCall } from "../llm-log";
import { getImageProvider, getLLM, type ImageProviderId } from "../../providers";
import type { CopyVariant, LLMProvider } from "../../providers/llm/types";
import { aspectForFormat, type ImageProvider } from "../../providers/image/types";
import { getStorage, makeKey } from "../../providers/storage";

export type PipelineDeps = { llm?: LLMProvider; image?: ImageProvider };

/** Simple promise pool. */
export async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  });
  await Promise.all(workers);
}

/** „Alege tu”: picks a style from the brief + industry (deterministic). */
export function chooseStyle<S extends { slug: string }>(list: S[], industry: string, message: string): S | null {
  const m = message.toLowerCase();
  const by = (slug: string) => list.find((s) => s.slug === slug);
  if (/\d+\s?%|reducere|discount|ofert|promo|lei\b/.test(m)) return by("oferta-clara") ?? list[0] ?? null;
  if (/eveniment|deschider|lansare|program|anunț|anunt/.test(m)) return by("anunt-eveniment") ?? list[0] ?? null;
  if (/recenzi|testimonial|părerea|clienți spun/.test(m)) return by("testimonial") ?? list[0] ?? null;
  if (industry === "food") return by("produs-fundal-colorat") ?? list[0] ?? null;
  if (industry === "beauty") return by("minimal-premium") ?? list[0] ?? null;
  return by("foto-full-gradient") ?? list[0] ?? null;
}

export function negativeSpaceFor(def: Parameters<typeof getLayout>[0], master: Format): CopyVariant["negativeSpace"] {
  const layout = getLayout(def, master);
  const headline = layout.layers.find((l) => l.type === "text" && l.role === "headline");
  if (!headline) return "center";
  const cy = headline.box.y + headline.box.h / 2;
  return cy > 0.55 ? "bottom" : cy < 0.4 ? "top" : "center";
}

export function pickMasterFormat(requested: string[]): string {
  return requested.includes("feed_4x5") ? "feed_4x5" : (requested[0] ?? "feed_4x5");
}

type StyleBundle = Style & { version: StyleVersion; definition: import("@/lib/template-types").TemplateDefinition; templateId: string };

async function loadStyleBundle(db: DB, styleId: string): Promise<StyleBundle | null> {
  const [s] = await db.select().from(styles).where(eq(styles.id, styleId));
  if (!s?.currentVersionId) return null;
  const [v] = await db.select().from(styleVersions).where(eq(styleVersions.id, s.currentVersionId));
  if (!v) return null;
  const [t] = await db.select().from(templates).where(eq(templates.id, v.templateId));
  if (!t) return null;
  return { ...s, version: v, definition: t.definition, templateId: t.id };
}

/** Builds documents for all requested formats from copy + background. */
export function composeDocuments(args: {
  bundle: { templateId: string; definition: StyleBundle["definition"] };
  formats: Format[];
  copy: VariantCopy;
  brand: BrandContext;
  backgroundKey: string | null;
}): Record<string, VariantDocument> {
  const docs: Record<string, VariantDocument> = {};
  for (const f of args.formats) {
    docs[f.key] = resolveDocument({
      templateId: args.bundle.templateId,
      definition: args.bundle.definition,
      format: { key: f.key, width: f.width, height: f.height, safeZone: f.safeZone },
      copy: args.copy,
      palette: args.brand.palette,
      fonts: args.brand.fonts,
      assets: { background: args.backgroundKey, logo: args.brand.logo, logoLight: args.brand.logoLight },
    });
  }
  return docs;
}

/** Swaps the image source of every image layer in every format document. */
export function replaceBackground(docs: Record<string, VariantDocument>, key: string): Record<string, VariantDocument> {
  const out: Record<string, VariantDocument> = {};
  for (const [k, d] of Object.entries(docs)) out[k] = { ...d, layers: d.layers.map((l) => (l.type === "image" ? { ...l, src: key } : l)) };
  return out;
}

/** Creates the generation row (queued). The caller runs `runGeneration` in the background. */
export async function createGeneration(db: DB, args: { clientId: string; projectId: string; userId: string | null; brief: BriefInput }) {
  const brief = normalizeDeep(args.brief);
  const [g] = await db
    .insert(generations)
    .values({ clientId: args.clientId, projectId: args.projectId, createdBy: args.userId, brief, status: "queued" })
    .returning();
  return g!;
}

async function loadImage(key: string) {
  const f = await getStorage().get(key);
  return f ? { data: f.data, mimeType: f.mimeType } : null;
}

/** Generates (or regenerates) the background of one variant and composes its documents. */
export async function produceVariantImage(
  db: DB,
  args: {
    variant: Variant;
    client: Client;
    brand: BrandContext;
    bundle: StyleBundle;
    formats: Format[];
    image: ImageProvider;
    referenceKeys: string[];
    generationId: string;
    useBrandPhotoKey?: string;
    promptSuffix?: string;
    /** keep the (possibly edited) documents and only swap the background image */
    keepDocuments?: boolean;
  },
): Promise<number> {
  const { variant, brand } = args;
  let cost = 0;
  try {
    let backgroundKey: string;
    const brandPhoto = args.useBrandPhotoKey && brand.photos.some((p) => p.key === args.useBrandPhotoKey) ? args.useBrandPhotoKey : null;
    if (brandPhoto) {
      backgroundKey = brandPhoto;
    } else {
      const refs = (await Promise.all(args.referenceKeys.slice(0, 4).map(loadImage))).filter((x): x is { data: Buffer; mimeType: string } => !!x);
      const prompt = [variant.visualPrompt, args.promptSuffix].filter(Boolean).join(" ");
      const { result } = await loggedCall(
        db,
        { purpose: "image", provider: args.image.id, model: args.image.model, generationId: args.generationId, clientId: args.client.id },
        () => args.image.generate({ prompt, aspect: aspectForFormat(variant.masterFormatKey), referenceImages: refs, quality: "medium" }),
        (r) => ({
          model: r.model,
          inputTokens: r.usage?.inputTokens,
          outputTokens: r.usage?.outputTokens,
          inputImageTokens: r.usage?.inputImageTokens,
          inputTextTokens: r.usage?.inputTextTokens,
          imageCount: 1,
        }),
      ).then((r) => {
        cost += r.costUsd;
        return r;
      });
      backgroundKey = makeKey(`clients/${args.client.id}/generated`, result.mimeType);
      await getStorage().put(backgroundKey, result.image, result.mimeType);
    }
    const documents =
      args.keepDocuments && Object.keys(variant.documents).length
        ? replaceBackground(variant.documents, backgroundKey)
        : composeDocuments({ bundle: args.bundle, formats: args.formats, copy: variant.copy, brand, backgroundKey });
    await db
      .update(variants)
      .set({ backgroundAssetKey: backgroundKey, documents, status: variant.status === "pending" || variant.status === "failed" ? "draft" : variant.status, error: null, previewKey: null, qa: null, documentVersion: variant.documentVersion + 1 })
      .where(eq(variants.id, variant.id));
  } catch (e) {
    await db
      .update(variants)
      .set({ status: "failed", error: e instanceof Error ? e.message : String(e) })
      .where(eq(variants.id, variant.id));
  }
  return cost;
}

/** The whole pipeline for one generation: context → copy (1 LLM call) → images (pool of 4) → composition. */
export async function runGeneration(db: DB, generationId: string, deps: PipelineDeps = {}) {
  const [gen] = await db.select().from(generations).where(eq(generations.id, generationId));
  if (!gen) return;
  const llm = deps.llm ?? getLLM();
  const brief = gen.brief;
  try {
    await db.update(generations).set({ status: "running", error: null }).where(eq(generations.id, generationId));
    const [client] = await db.select().from(clients).where(eq(clients.id, gen.clientId));
    if (!client) throw new Error("Client inexistent");
    const image = deps.image ?? (await getImageProvider(db, brief.imageProvider as ImageProviderId | undefined));
    await db.update(generations).set({ llmProvider: `${llm.id}:${llm.model}`, imageProvider: `${image.id}:${image.model}` }).where(eq(generations.id, generationId));

    const allFormats = await db.select().from(formatsTable).orderBy(asc(formatsTable.sortOrder));
    const requested = allFormats.filter((f) => brief.formats.includes(f.key));
    if (!requested.length) throw new Error("Niciun format valid ales.");
    const masterKey = pickMasterFormat(requested.map((f) => f.key));
    const master = requested.find((f) => f.key === masterKey)!;

    let styleId = brief.styleId;
    if (!styleId) {
      const list = await db.select().from(styles).where(isNull(styles.archivedAt));
      styleId = chooseStyle(list, client.industry, brief.message)?.id ?? null;
    }
    if (!styleId) throw new Error("Nu există niciun stil în bibliotecă.");
    const bundle = await loadStyleBundle(db, styleId);
    if (!bundle) throw new Error("Stilul ales nu are o versiune publicată.");

    const brand = await getBrandContext(db, client);
    const { snapshot } = await buildContext(db, {
      client,
      styleId,
      formats: requested,
      brief: { message: brief.message, cta: brief.cta, notes: brief.notes, formats: requested.map((f) => f.key), angles: brief.angles },
    });
    await db.update(generations).set({ contextSnapshot: snapshot }).where(eq(generations.id, generationId));

    let totalCost = 0;
    const copyRes = await loggedCall(
      db,
      { purpose: "copy", provider: llm.id, model: llm.model, generationId, clientId: client.id },
      () =>
        llm.writeCopy({
          contextPrompt: snapshot.prompt,
          variantCount: brief.variantCount,
          angles: brief.angles,
          brief: { message: brief.message, cta: brief.cta, notes: brief.notes },
          industry: client.industry,
          palette: client.colors.map((c) => ({ role: c.role, hex: c.hex, name: c.name })),
          style: { name: bundle.name, visualPrompt: bundle.version.visualPrompt, avoid: bundle.version.avoid, copyGuidance: bundle.version.copyGuidance, textMode: bundle.version.textMode },
          negativeSpaceHint: negativeSpaceFor(bundle.definition, master),
          brandPhotos: brand.photos,
        }),
      (r) => ({ ...r.usage, model: r.model, promptVersion: r.promptVersion }),
    );
    totalCost += copyRes.costUsd;
    const copyVariants = copyRes.result.data.variants.slice(0, brief.variantCount);

    const rows = await db
      .insert(variants)
      .values(
        copyVariants.map((v, i) => ({
          generationId,
          clientId: client.id,
          index: i + 1,
          angle: v.angle,
          copy: normalizeDeep({ headline: v.headline, subheadline: v.subheadline, cta: v.cta, extra: v.extra }),
          styleVersionId: bundle.version.id,
          masterFormatKey: masterKey,
          visualPrompt: v.visualPrompt,
          rationale: normalizeDiacritics(v.rationale),
          status: "pending" as const,
        })),
      )
      .returning();

    const referenceKeys = [...bundle.version.referenceAssetKeys.slice(0, 2), ...brief.referenceKeys.slice(0, 2), ...brand.photos.slice(0, 2).map((p) => p.key)].slice(0, 4);
    await runPool(rows, 4, async (row) => {
      const cv = copyVariants[row.index - 1];
      totalCost += await produceVariantImage(db, {
        variant: row,
        client,
        brand,
        bundle,
        formats: requested,
        image,
        referenceKeys,
        generationId,
        useBrandPhotoKey: cv?.useBrandPhotoKey,
      });
    });

    const final = await db.select().from(variants).where(eq(variants.generationId, generationId));
    const allFailed = final.length > 0 && final.every((v) => v.status === "failed");
    await db
      .update(generations)
      .set({
        status: allFailed ? "failed" : "done",
        error: allFailed ? (final[0]?.error ?? "Toate variantele au eșuat") : null,
        costUsd: totalCost,
        usage: { inputTokens: copyRes.result.usage.inputTokens, outputTokens: copyRes.result.usage.outputTokens, images: final.filter((v) => v.backgroundAssetKey).length },
      })
      .where(eq(generations.id, generationId));
  } catch (e) {
    await db
      .update(generations)
      .set({ status: "failed", error: e instanceof Error ? e.message : String(e) })
      .where(eq(generations.id, generationId));
  }
}

/** Regenerates only the image of one variant (optionally with an extra instruction). */
export async function regenerateVariantImage(db: DB, variantId: string, opts: { instruction?: string; deps?: PipelineDeps; keepDocuments?: boolean } = {}) {
  const [v] = await db.select().from(variants).where(eq(variants.id, variantId));
  if (!v) throw new Error("Variantă inexistentă");
  const [gen] = await db.select().from(generations).where(eq(generations.id, v.generationId));
  const [client] = await db.select().from(clients).where(eq(clients.id, v.clientId));
  if (!gen || !client || !v.styleVersionId) throw new Error("Date lipsă pentru regenerare");
  const [sv] = await db.select().from(styleVersions).where(eq(styleVersions.id, v.styleVersionId));
  const [t] = sv ? await db.select().from(templates).where(eq(templates.id, sv.templateId)) : [];
  const [s] = sv ? await db.select().from(styles).where(eq(styles.id, sv.styleId)) : [];
  if (!sv || !t || !s) throw new Error("Stilul variantei nu mai există");
  const fmtKeys = Object.keys(v.documents).length ? Object.keys(v.documents) : gen.brief.formats;
  const fmts = await db.select().from(formatsTable).where(inArray(formatsTable.key, fmtKeys));
  const brand = await getBrandContext(db, client);
  const image = opts.deps?.image ?? (await getImageProvider(db, gen.brief.imageProvider as ImageProviderId | undefined));
  await db.update(variants).set({ status: "pending", error: null }).where(eq(variants.id, v.id));
  const prompt = opts.instruction ? `${v.visualPrompt} Additional instruction from the team: ${opts.instruction}` : v.visualPrompt;
  if (opts.instruction) await db.update(variants).set({ visualPrompt: prompt }).where(eq(variants.id, v.id));
  const cost = await produceVariantImage(db, {
    variant: { ...v, visualPrompt: prompt, status: v.status === "pending" ? "draft" : v.status },
    client,
    brand,
    bundle: { ...s, version: sv, definition: t.definition, templateId: t.id },
    formats: fmts,
    image,
    referenceKeys: [...sv.referenceAssetKeys.slice(0, 2), ...gen.brief.referenceKeys.slice(0, 2)],
    generationId: gen.id,
    keepDocuments: opts.keepDocuments,
  });
  await db.update(generations).set({ costUsd: gen.costUsd + cost }).where(eq(generations.id, gen.id));
}

/** Duplicates a variant (same copy, documents and background) as a new draft in the same generation. */
export async function duplicateVariant(db: DB, variantId: string) {
  const [v] = await db.select().from(variants).where(eq(variants.id, variantId));
  if (!v) throw new Error("Variantă inexistentă");
  const siblings = await db.select({ index: variants.index }).from(variants).where(and(eq(variants.generationId, v.generationId)));
  const nextIndex = Math.max(0, ...siblings.map((s) => s.index)) + 1;
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = v;
  const [copy] = await db
    .insert(variants)
    .values({ ...rest, index: nextIndex, status: v.status === "failed" ? "failed" : "draft", documentVersion: 1 })
    .returning();
  return copy!;
}
