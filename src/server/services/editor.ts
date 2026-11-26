import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "../db/connect";
import { clients, generations, projects, styleVersions, styles, templates, variants } from "../db/schema";
import type { VariantDocument } from "@/lib/template-types";
import type { VariantCopy } from "@/lib/types";
import { normalizeDeep } from "@/lib/diacritics";
import { getBrandContext } from "./brand";
import { listFormats } from "./library";
import { getStorage, makeKey } from "../providers/storage";
import { detectMime } from "./assets";

export async function getEditorData(db: DB, variantId: string) {
  const [v] = await db.select().from(variants).where(eq(variants.id, variantId));
  if (!v) return null;
  const [gen] = await db.select().from(generations).where(eq(generations.id, v.generationId));
  const [client] = await db.select().from(clients).where(eq(clients.id, v.clientId));
  const [project] = gen ? await db.select().from(projects).where(eq(projects.id, gen.projectId)) : [];
  const [sv] = v.styleVersionId ? await db.select().from(styleVersions).where(eq(styleVersions.id, v.styleVersionId)) : [];
  const [style] = sv ? await db.select().from(styles).where(eq(styles.id, sv.styleId)) : [];
  const [template] = sv ? await db.select().from(templates).where(eq(templates.id, sv.templateId)) : [];
  if (!gen || !client || !project) return null;
  const brand = await getBrandContext(db, client);
  const formats = await listFormats(db);
  return { variant: v, generation: gen, client, project, style: style ?? null, styleVersion: sv ?? null, template: template ?? null, brand, formats };
}

/** Text of the master document's text layers → variant.copy (kept in sync for context examples). */
export function copyFromDocument(doc: VariantDocument | undefined, prev: VariantCopy): VariantCopy {
  if (!doc) return prev;
  const t = (role: string) => {
    const l = doc.layers.find((x) => x.type === "text" && x.role === role);
    return l && l.type === "text" ? l.text : undefined;
  };
  return {
    headline: t("headline") ?? prev.headline,
    subheadline: t("subheadline") ?? prev.subheadline,
    cta: t("cta") ?? prev.cta,
    extra: { price: t("price") ?? prev.extra?.price, badge: t("badge") ?? prev.extra?.badge },
  };
}

const documentSchema = z.object({
  templateId: z.string(),
  formatKey: z.string(),
  width: z.number(),
  height: z.number(),
  background: z.string(),
  layers: z.array(z.record(z.string(), z.unknown())),
});

/** Saves all format documents; documentVersion++ and the preview is invalidated (re-rendered by the browser). */
export async function saveDocuments(db: DB, variantId: string, documents: Record<string, unknown>, expectedVersion?: number) {
  const [v] = await db.select().from(variants).where(eq(variants.id, variantId));
  if (!v) throw new Error("Variantă inexistentă");
  if (expectedVersion !== undefined && expectedVersion !== v.documentVersion) {
    throw new Error("Varianta a fost modificată între timp (altă fereastră sau regenerare). Reîncarcă pagina.");
  }
  const parsed = z.record(z.string(), documentSchema).parse(documents);
  const docs = normalizeDeep(parsed) as unknown as Record<string, VariantDocument>;
  const bg = Object.values(docs)
    .flatMap((d) => d.layers)
    .find((l) => l.type === "image" && l.src);
  const [u] = await db
    .update(variants)
    .set({
      documents: docs,
      copy: copyFromDocument(docs[v.masterFormatKey], v.copy),
      documentVersion: v.documentVersion + 1,
      backgroundAssetKey: bg && bg.type === "image" ? bg.src : v.backgroundAssetKey,
      previewKey: null,
      qa: null,
    })
    .where(eq(variants.id, variantId))
    .returning();
  return u!;
}

export async function uploadVariantImage(db: DB, variantId: string, file: { name: string; type: string; data: Buffer }) {
  const [v] = await db.select().from(variants).where(eq(variants.id, variantId));
  if (!v) throw new Error("Variantă inexistentă");
  const mime = detectMime(file);
  if (!mime.startsWith("image/") || mime === "image/svg+xml") throw new Error("Încarcă o imagine PNG, JPG sau WebP.");
  const key = makeKey(`clients/${v.clientId}/uploads`, mime);
  await getStorage().put(key, file.data, mime);
  return key;
}
