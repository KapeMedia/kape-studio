import { and, asc, desc, eq, isNull, max } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "../db/connect";
import { formats, styleVersions, styles, templates } from "../db/schema";
import { templateDefinitionSchema, type TemplateDefinition } from "@/lib/template-types";
import { normalizeDeep } from "@/lib/diacritics";
import { slugify } from "@/lib/utils";

// ---------------- formats ----------------
export async function listFormats(db: DB, opts: { enabledOnly?: boolean } = {}) {
  return db
    .select()
    .from(formats)
    .where(opts.enabledOnly ? eq(formats.enabled, true) : undefined)
    .orderBy(asc(formats.sortOrder), asc(formats.key));
}

export const formatUpdateSchema = z.object({
  label: z.string().min(1),
  width: z.number().int().min(100).max(5000),
  height: z.number().int().min(100).max(5000),
  safeZone: z.object({
    top: z.number().min(0),
    right: z.number().min(0),
    bottom: z.number().min(0),
    left: z.number().min(0),
    avoidRects: z.array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })).optional(),
  }),
  notes: z.string().default(""),
  enabled: z.boolean(),
});

export async function updateFormat(db: DB, id: string, input: z.input<typeof formatUpdateSchema>) {
  const data = normalizeDeep(formatUpdateSchema.parse(input));
  const [f] = await db.update(formats).set(data).where(eq(formats.id, id)).returning();
  return f!;
}

// ---------------- templates ----------------
export async function listTemplates(db: DB) {
  return db.select().from(templates).orderBy(asc(templates.name));
}
export async function getTemplate(db: DB, id: string) {
  const [t] = await db.select().from(templates).where(eq(templates.id, id));
  return t ?? null;
}
export async function saveTemplate(db: DB, id: string | null, input: { name: string; description?: string; definition: unknown }) {
  const definition: TemplateDefinition = templateDefinitionSchema.parse(input.definition);
  const values = normalizeDeep({ name: input.name.trim() || "Template", description: input.description ?? "", definition });
  if (id) {
    const [t] = await db.update(templates).set(values).where(eq(templates.id, id)).returning();
    return t!;
  }
  const [t] = await db.insert(templates).values(values).returning();
  return t!;
}

// ---------------- styles ----------------
export async function listStyles(db: DB, opts: { includeArchived?: boolean } = {}) {
  const rows = await db
    .select({ style: styles, version: styleVersions })
    .from(styles)
    .leftJoin(styleVersions, eq(styleVersions.id, styles.currentVersionId))
    .where(opts.includeArchived ? undefined : isNull(styles.archivedAt))
    .orderBy(asc(styles.createdAt));
  return rows;
}

export async function getStyle(db: DB, id: string) {
  const [s] = await db.select().from(styles).where(eq(styles.id, id));
  if (!s) return null;
  const versions = await db.select().from(styleVersions).where(eq(styleVersions.styleId, id)).orderBy(desc(styleVersions.version));
  return { style: s, versions, current: versions.find((v) => v.id === s.currentVersionId) ?? versions[0] ?? null };
}

export async function getStyleVersion(db: DB, id: string) {
  const [v] = await db.select().from(styleVersions).where(eq(styleVersions.id, id));
  return v ?? null;
}

export const styleVersionInputSchema = z.object({
  templateId: z.string().uuid(),
  visualPrompt: z.string().default(""),
  avoid: z.string().default(""),
  copyGuidance: z.string().default(""),
  referenceAssetKeys: z.array(z.string()).default([]),
  textMode: z.enum(["overlay", "full_ai"]).default("overlay"),
  changelog: z.string().default(""),
});

export const styleMetaSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().default(""),
  whenToUse: z.string().default(""),
});

export async function createStyle(db: DB, meta: z.input<typeof styleMetaSchema>, version: z.input<typeof styleVersionInputSchema>) {
  const m = normalizeDeep(styleMetaSchema.parse(meta));
  const v = normalizeDeep(styleVersionInputSchema.parse(version));
  let slug = slugify(m.name) || "stil";
  const [exists] = await db.select({ id: styles.id }).from(styles).where(eq(styles.slug, slug));
  if (exists) slug = `${slug}-${Date.now().toString(36)}`;
  const [s] = await db.insert(styles).values({ ...m, slug }).returning();
  const [ver] = await db.insert(styleVersions).values({ ...v, styleId: s!.id, version: 1 }).returning();
  await db.update(styles).set({ currentVersionId: ver!.id }).where(eq(styles.id, s!.id));
  return s!;
}

/** Saving a style creates a NEW version; the live version changes only on publish. */
export async function saveStyleVersion(
  db: DB,
  styleId: string,
  meta: z.input<typeof styleMetaSchema>,
  version: z.input<typeof styleVersionInputSchema>,
) {
  const m = normalizeDeep(styleMetaSchema.parse(meta));
  const v = normalizeDeep(styleVersionInputSchema.parse(version));
  await db.update(styles).set(m).where(eq(styles.id, styleId));
  const [row] = await db.select({ n: max(styleVersions.version) }).from(styleVersions).where(eq(styleVersions.styleId, styleId));
  const next = (row?.n ?? 0) + 1;
  const [ver] = await db.insert(styleVersions).values({ ...v, styleId, version: next }).returning();
  return ver!;
}

export async function publishStyleVersion(db: DB, styleId: string, versionId: string) {
  const [v] = await db
    .select()
    .from(styleVersions)
    .where(and(eq(styleVersions.id, versionId), eq(styleVersions.styleId, styleId)));
  if (!v) throw new Error("Versiune inexistentă");
  await db.update(styles).set({ currentVersionId: v.id }).where(eq(styles.id, styleId));
  return v;
}

export async function setStyleArchived(db: DB, styleId: string, archived: boolean) {
  await db.update(styles).set({ archivedAt: archived ? new Date() : null }).where(eq(styles.id, styleId));
}
