import { priceFor } from "./prices";

export type CostUsage = {
  inputTokens?: number;
  outputTokens?: number;
  inputTextTokens?: number;
  inputImageTokens?: number;
  outputImageTokens?: number;
  imageCount?: number;
};

const M = 1_000_000;

/** Cost in USD for one call. Unknown models → 0 (flagged in Settings). */
export function computeCost(provider: string, model: string, u: CostUsage): number {
  const p = priceFor(provider, model);
  if (!p) return 0;
  let cost = 0;
  if (p.imageInput !== undefined || p.imageOutput !== undefined) {
    const textIn = u.inputTextTokens ?? (u.inputImageTokens === undefined ? (u.inputTokens ?? 0) : 0);
    cost += (textIn * p.input) / M;
    cost += ((u.inputImageTokens ?? 0) * (p.imageInput ?? 0)) / M;
    cost += ((u.outputImageTokens ?? u.outputTokens ?? 0) * (p.imageOutput ?? 0)) / M;
    if (p.perImage && !u.outputTokens && !u.outputImageTokens) cost += (u.imageCount ?? 0) * p.perImage;
  } else {
    cost += ((u.inputTokens ?? 0) * p.input) / M;
    cost += ((u.outputTokens ?? 0) * p.output) / M;
  }
  return Math.round(cost * 1e6) / 1e6;
}
