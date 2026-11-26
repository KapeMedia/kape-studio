import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { DB } from "../../db/connect";
import { generations, projects, styleVersions, styles, users, variants } from "../../db/schema";
import type { ContextSnapshot, QaResult, VariantCopy } from "@/lib/types";
import type { VariantDocument } from "@/lib/template-types";
import { fileUrl } from "../../providers/storage/types";

export type VariantView = {
  id: string;
  index: number;
  angle: string;
  copy: VariantCopy;
  status: string;
  error: string | null;
  previewUrl: string | null;
  masterFormatKey: string;
  masterDoc: VariantDocument | null;
  documentVersion: number;
  qa: QaResult | null;
  rationale: string;
  rejectReason: string | null;
  styleName: string | null;
  styleVersion: number | null;
};

export type GenerationView = {
  id: string;
  createdAt: string;
  status: string;
  error: string | null;
  authorName: string | null;
  clientId: string;
  projectId: string;
  projectName: string | null;
  brief: { message: string; formats: string[]; variantCount: number; styleId: string | null };
  styleName: string | null;
  costUsd: number;
  llmProvider: string | null;
  imageProvider: string | null;
  snapshot: ContextSnapshot | null;
  variants: VariantView[];
};

export async function listGenerations(
  db: DB,
  filter: { projectId?: string; clientId?: string; status?: string; limit?: number; includeSnapshot?: boolean },
): Promise<GenerationView[]> {
  const conds: SQL[] = [];
  if (filter.projectId) conds.push(eq(generations.projectId, filter.projectId));
  if (filter.clientId) conds.push(eq(generations.clientId, filter.clientId));
  if (filter.status && ["queued", "running", "done", "failed"].includes(filter.status)) {
    conds.push(eq(generations.status, filter.status as "queued" | "running" | "done" | "failed"));
  }
  const gens = await db
    .select({ g: generations, author: users.name, projectName: projects.name })
    .from(generations)
    .leftJoin(users, eq(users.id, generations.createdBy))
    .leftJoin(projects, eq(projects.id, generations.projectId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(generations.createdAt))
    .limit(filter.limit ?? 30);
  if (!gens.length) return [];
  const vs = await db
    .select({ v: variants, styleName: styles.name, styleVersion: styleVersions.version })
    .from(variants)
    .leftJoin(styleVersions, eq(styleVersions.id, variants.styleVersionId))
    .leftJoin(styles, eq(styles.id, styleVersions.styleId))
    .where(inArray(variants.generationId, gens.map((g) => g.g.id)))
    .orderBy(variants.index);
  return gens.map(({ g, author, projectName }) => {
    const own = vs.filter((x) => x.v.generationId === g.id);
    return {
      id: g.id,
      createdAt: g.createdAt.toISOString(),
      status: g.status,
      error: g.error,
      authorName: author,
      clientId: g.clientId,
      projectId: g.projectId,
      projectName,
      brief: { message: g.brief.message, formats: g.brief.formats, variantCount: g.brief.variantCount, styleId: g.brief.styleId },
      styleName: g.contextSnapshot?.style?.name ?? own[0]?.styleName ?? null,
      costUsd: g.costUsd,
      llmProvider: g.llmProvider,
      imageProvider: g.imageProvider,
      snapshot: filter.includeSnapshot === false ? null : g.contextSnapshot,
      variants: own.map(({ v, styleName, styleVersion }) => ({
        id: v.id,
        index: v.index,
        angle: v.angle,
        copy: v.copy,
        status: v.status,
        error: v.error,
        previewUrl: fileUrl(v.previewKey),
        masterFormatKey: v.masterFormatKey,
        masterDoc: v.documents[v.masterFormatKey] ?? null,
        documentVersion: v.documentVersion,
        qa: v.qa,
        rationale: v.rationale,
        rejectReason: v.rejectReason,
        styleName,
        styleVersion,
      })),
    };
  });
}
