import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "../../db/connect";
import { brainEntries, feedback, formats, styleVersions, styles, users, variants } from "../../db/schema";
import type { FeedbackInterpretation } from "@/lib/types";
import { normalizeDeep, normalizeDiacritics } from "@/lib/diacritics";
import type { LLMProvider } from "../../providers/llm/types";
import { getLLM } from "../../providers";
import { loggedCall } from "../llm-log";
import { confirmByFeedback, createTrialRule } from "./entries";

export type FeedbackResult = {
  feedbackId: string;
  interpretation: FeedbackInterpretation;
  created: { id: string; text: string; status: string; suggestAgencyWide: boolean; confirmed: boolean }[];
};

/**
 * Feedback → Claude interpretation → trial rules (or confirmations of existing rules).
 * SPEC §11.1.
 */
export async function submitFeedback(db: DB, args: { variantId: string; authorId: string | null; text: string; llm?: LLMProvider }): Promise<FeedbackResult> {
  const text = normalizeDiacritics(args.text.trim());
  if (text.length < 2) throw new Error("Scrie un comentariu.");
  const [v] = await db.select().from(variants).where(eq(variants.id, args.variantId));
  if (!v) throw new Error("Variantă inexistentă");
  const [author] = args.authorId ? await db.select().from(users).where(eq(users.id, args.authorId)) : [];
  const [sv] = v.styleVersionId ? await db.select().from(styleVersions).where(eq(styleVersions.id, v.styleVersionId)) : [];
  const [style] = sv ? await db.select().from(styles).where(eq(styles.id, sv.styleId)) : [];
  const existing = await db
    .select()
    .from(brainEntries)
    .where(and(eq(brainEntries.clientId, v.clientId), inArray(brainEntries.status, ["trial", "active"])));
  const allFormats = await db.select({ key: formats.key }).from(formats);
  const allStyles = await db.select({ slug: styles.slug }).from(styles).where(isNull(styles.archivedAt));

  const llm = args.llm ?? getLLM();
  const { result } = await loggedCall(
    db,
    { purpose: "feedback_interpret", provider: llm.id, model: llm.model, generationId: v.generationId, clientId: v.clientId },
    () =>
      llm.interpretFeedback({
        comment: text,
        variant: { headline: v.copy.headline, subheadline: v.copy.subheadline, cta: v.copy.cta, style: style?.slug ?? null, format: v.masterFormatKey },
        existingRules: existing.map((e) => ({ id: e.id, text: e.text, status: e.status })),
        availableFormats: allFormats.map((f) => f.key),
        availableStyles: allStyles.map((s) => s.slug),
      }),
    (r) => ({ ...r.usage, model: r.model, promptVersion: r.promptVersion }),
  );
  const interpretation = normalizeDeep(result.data);

  const [fb] = await db.insert(feedback).values({ variantId: v.id, clientId: v.clientId, authorId: args.authorId, text, interpretation }).returning();
  const today = new Date().toISOString().slice(0, 10);
  const created: FeedbackResult["created"] = [];
  const validFormats = new Set(allFormats.map((f) => f.key));
  for (const rule of interpretation.rules) {
    const match = rule.matchesExistingRuleId ? existing.find((e) => e.id === rule.matchesExistingRuleId) : undefined;
    if (match) {
      const u = await confirmByFeedback(db, match.id, { feedbackId: fb!.id, quote: text }, args.authorId);
      created.push({ id: u.id, text: u.text, status: u.status, suggestAgencyWide: u.suggestAgencyWide, confirmed: true });
      continue;
    }
    const scope = {
      ...(rule.scope.formats?.filter((f) => validFormats.has(f)).length ? { formats: rule.scope.formats.filter((f) => validFormats.has(f)) } : {}),
      ...(rule.scope.styles?.length ? { styles: rule.scope.styles } : {}),
    };
    const e = await createTrialRule(db, {
      clientId: v.clientId,
      text: rule.text,
      scope,
      source: { feedbackId: fb!.id, variantId: v.id, authorId: args.authorId ?? undefined, authorName: author?.name, quote: text, date: today },
      suggestAgencyWide: rule.isAgencyWide,
      actorId: args.authorId,
    });
    created.push({ id: e.id, text: e.text, status: e.status, suggestAgencyWide: e.suggestAgencyWide, confirmed: false });
  }
  await db.update(feedback).set({ createdBrainEntryIds: created.map((c) => c.id) }).where(eq(feedback.id, fb!.id));
  return { feedbackId: fb!.id, interpretation, created };
}

export async function listFeedbackForVariant(db: DB, variantId: string) {
  const rows = await db
    .select({ f: feedback, author: users.name })
    .from(feedback)
    .leftJoin(users, eq(users.id, feedback.authorId))
    .where(eq(feedback.variantId, variantId))
    .orderBy(desc(feedback.createdAt));
  const ids = rows.flatMap((r) => r.f.createdBrainEntryIds);
  const entries = ids.length ? await db.select().from(brainEntries).where(inArray(brainEntries.id, ids)) : [];
  return rows.map(({ f, author }) => ({
    id: f.id,
    text: f.text,
    author,
    createdAt: f.createdAt.toISOString(),
    summary: f.interpretation?.summary ?? "",
    oneOff: f.interpretation?.oneOff?.instruction ?? null,
    entries: f.createdBrainEntryIds
      .map((id) => entries.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ id: e.id, text: e.text, status: e.status, suggestAgencyWide: e.suggestAgencyWide, scope: e.scope })),
  }));
}
export type FeedbackItem = Awaited<ReturnType<typeof listFeedbackForVariant>>[number];
