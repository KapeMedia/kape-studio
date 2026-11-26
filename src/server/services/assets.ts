import { eq } from "drizzle-orm";
import type { DB } from "../db/connect";
import { brandAssets, references } from "../db/schema";
import { getStorage, makeKey } from "../providers/storage";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
const FONT_EXT: Record<string, string> = { ttf: "font/ttf", otf: "font/otf", woff2: "font/woff2", woff: "font/woff" };
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function detectMime(file: { name: string; type: string }): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (FONT_EXT[ext]) return FONT_EXT[ext];
  if (file.type) return file.type;
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

export async function imageSize(data: Buffer): Promise<{ width: number | null; height: number | null }> {
  try {
    const { default: sharp } = await import("sharp");
    const m = await sharp(data).metadata();
    return { width: m.width ?? null, height: m.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

export type AssetType = "logo" | "logo_light" | "photo" | "font" | "other";

export async function saveBrandAsset(
  db: DB,
  clientId: string,
  type: AssetType,
  file: { name: string; type: string; data: Buffer },
  meta: { family?: string; role?: "heading" | "body"; weight?: number } = {},
) {
  if (file.data.length > MAX_UPLOAD_BYTES) throw new Error("Fișierul e prea mare (maxim 20 MB).");
  const mimeType = detectMime(file);
  if (type === "font") {
    if (!mimeType.startsWith("font/")) throw new Error("Fontul trebuie să fie .ttf, .otf sau .woff2.");
  } else if (!IMAGE_TYPES.includes(mimeType)) {
    throw new Error("Format de imagine nesuportat (PNG, JPG, WebP, SVG).");
  }
  const key = makeKey(`clients/${clientId}/${type}`, mimeType);
  await getStorage().put(key, file.data, mimeType);
  const size = type === "font" ? { width: null, height: null } : await imageSize(file.data);

  // Only one logo / logo_light at a time: replace the previous one.
  if (type === "logo" || type === "logo_light") {
    const old = await db.select().from(brandAssets).where(eq(brandAssets.clientId, clientId));
    for (const a of old.filter((x) => x.type === type)) {
      await db.delete(brandAssets).where(eq(brandAssets.id, a.id));
      await getStorage().delete(a.storageKey).catch(() => {});
    }
  }

  const fontMeta =
    type === "font"
      ? {
          family: meta.family?.trim() || file.name.replace(/\.[^.]+$/, ""),
          role: meta.role ?? "heading",
          weight: meta.weight ?? 400,
          style: "normal",
        }
      : {};
  const [asset] = await db
    .insert(brandAssets)
    .values({
      clientId,
      type,
      name: file.name,
      storageKey: key,
      mimeType,
      width: size.width,
      height: size.height,
      meta: fontMeta,
    })
    .returning();
  return asset!;
}

export async function deleteBrandAsset(db: DB, id: string) {
  const [a] = await db.delete(brandAssets).where(eq(brandAssets.id, id)).returning();
  if (a) await getStorage().delete(a.storageKey).catch(() => {});
  return a ?? null;
}

export async function updateFontMeta(db: DB, id: string, meta: { family?: string; role?: "heading" | "body"; missingGlyphs?: string[] }) {
  const [a] = await db.select().from(brandAssets).where(eq(brandAssets.id, id));
  if (!a) return null;
  const [u] = await db
    .update(brandAssets)
    .set({ meta: { ...a.meta, ...meta } })
    .where(eq(brandAssets.id, id))
    .returning();
  return u!;
}

export async function saveReferenceImage(
  db: DB,
  clientId: string,
  projectId: string | null,
  file: { name: string; type: string; data: Buffer },
  note = "",
) {
  const mimeType = detectMime(file);
  if (!IMAGE_TYPES.includes(mimeType)) throw new Error("Format de imagine nesuportat.");
  const key = makeKey(`clients/${clientId}/references`, mimeType);
  await getStorage().put(key, file.data, mimeType);
  const [r] = await db
    .insert(references)
    .values({ clientId, projectId, storageKey: key, note, kind: "inspiration" })
    .returning();
  return r!;
}

export async function deleteReference(db: DB, id: string) {
  const [r] = await db.delete(references).where(eq(references.id, id)).returning();
  return r ?? null;
}
