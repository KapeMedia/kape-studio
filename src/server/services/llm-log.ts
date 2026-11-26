import { desc, eq } from "drizzle-orm";
import type { DB } from "../db/connect";
import { llmCalls } from "../db/schema";
import { computeCost, type CostUsage } from "./costs/calc";

export type CallPurpose = "angles" | "copy" | "feedback_interpret" | "qa_vision" | "image" | "test";

/** Runs `fn`, logs the call in llm_calls (cost, tokens, duration, error) and rethrows errors. */
export async function loggedCall<T>(
  db: DB,
  meta: { purpose: CallPurpose; provider: string; model: string; generationId?: string | null; clientId?: string | null; promptVersion?: string },
  fn: () => Promise<T>,
  usageOf: (r: T) => CostUsage & { model?: string; promptVersion?: string },
): Promise<{ result: T; costUsd: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    const u = usageOf(result);
    const model = u.model ?? meta.model;
    const costUsd = computeCost(meta.provider, model, u);
    await db.insert(llmCalls).values({
      generationId: meta.generationId ?? null,
      clientId: meta.clientId ?? null,
      purpose: meta.purpose,
      provider: meta.provider,
      model,
      promptVersion: u.promptVersion ?? meta.promptVersion ?? null,
      inputTokens: u.inputTokens ?? 0,
      outputTokens: u.outputTokens ?? 0,
      imageCount: u.imageCount ?? 0,
      costUsd,
      durationMs: Date.now() - start,
      ok: true,
    });
    return { result, costUsd };
  } catch (e) {
    await db
      .insert(llmCalls)
      .values({
        generationId: meta.generationId ?? null,
        clientId: meta.clientId ?? null,
        purpose: meta.purpose,
        provider: meta.provider,
        model: meta.model,
        promptVersion: meta.promptVersion ?? null,
        durationMs: Date.now() - start,
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 1000) : String(e),
      })
      .catch(() => {});
    throw e;
  }
}

/** Last call per provider (for the Settings status: active / mock / error on last call). */
export async function lastCallFor(db: DB, provider: string) {
  const [row] = await db.select().from(llmCalls).where(eq(llmCalls.provider, provider)).orderBy(desc(llmCalls.createdAt)).limit(1);
  return row ?? null;
}
