import { and, eq } from "drizzle-orm";
import type { DB } from "../db/connect";
import { generations, references, variants } from "../db/schema";
import { getStorage, makeKey } from "../providers/storage";

export type VariantStatus = "draft" | "in_review" | "approved" | "rejected" | "delivered";

/** Approve → approved_example reference; reject (with reason) → rejected_example. Used in context step 8. */
export async function setVariantStatus(db: DB, variantId: string, status: VariantStatus, reason?: string) {
  const [v] = await db.select().from(variants).where(eq(variants.id, variantId));
  if (!v) throw new Error("Variantă inexistentă");
  const [gen] = await db.select().from(generations).where(eq(generations.id, v.generationId));
  await db
    .update(variants)
    .set({ status, rejectReason: status === "rejected" ? reason?.trim() || null : v.rejectReason })
    .where(eq(variants.id, variantId));

  // Keep at most one example reference per variant, matching its latest verdict.
  await db.delete(references).where(and(eq(references.sourceVariantId, variantId)));
  if (status === "approved" || status === "delivered") {
    await db.insert(references).values({
      clientId: v.clientId,
      projectId: gen?.projectId ?? null,
      storageKey: v.previewKey,
      note: `${v.copy.headline} / ${v.copy.cta}`,
      kind: "approved_example",
      sourceVariantId: v.id,
    });
  } else if (status === "rejected") {
    await db.insert(references).values({
      clientId: v.clientId,
      projectId: gen?.projectId ?? null,
      storageKey: v.previewKey,
      note: reason?.trim() ?? "",
      kind: "rejected_example",
      sourceVariantId: v.id,
    });
  }
}

/** Stores the browser-rendered PNG preview of the master format. */
export async function savePreview(db: DB, variantId: string, png: Buffer) {
  const [v] = await db.select().from(variants).where(eq(variants.id, variantId));
  if (!v) throw new Error("Variantă inexistentă");
  const key = makeKey(`clients/${v.clientId}/previews`, "image/png");
  await getStorage().put(key, png, "image/png");
  const old = v.previewKey;
  await db.update(variants).set({ previewKey: key }).where(eq(variants.id, variantId));
  // references created before the preview existed point to the new preview
  await db.update(references).set({ storageKey: key }).where(eq(references.sourceVariantId, variantId));
  if (old) await getStorage().delete(old).catch(() => {});
  return key;
}
