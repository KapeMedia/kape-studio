/**
 * Price table (USD). Editable. Values per 1M tokens unless noted.
 * Mock providers always cost 0.
 */
export type PriceEntry = {
  /** text input tokens */
  input: number;
  /** text output tokens */
  output: number;
  /** image input tokens (image models) */
  imageInput?: number;
  /** image output tokens (image models) */
  imageOutput?: number;
  /** flat price per generated image when the API reports no tokens */
  perImage?: number;
  /** true = not verified against the provider's public pricing, shown as TODO in Settings */
  todo?: boolean;
  note?: string;
};

export const PRICES: Record<string, PriceEntry> = {
  // OpenAI gpt-image-2 (SPEC §M6): text in $5/1M, image in $8/1M, image out $30/1M
  "openai:gpt-image-2": { input: 5, output: 0, imageInput: 8, imageOutput: 30 },
  // Anthropic Claude Sonnet 5.5: $2 / $10 per 1M tokens (Anthropic pricing, Nov 2026)
  "anthropic:claude-sonnet-5-5": { input: 2, output: 10 },
  "anthropic:claude-opus-5-5": { input: 4, output: 20 },
  // Google Gemini 3 Pro Image ("Nano Banana Pro"): not verified offline → 0 with TODO
  "gemini:gemini-3-pro-image-preview": { input: 0, output: 0, imageOutput: 0, todo: true, note: "Prețul nu a fost verificat; completează în prices.ts." },
};

export function priceFor(provider: string, model: string): PriceEntry | null {
  if (provider === "mock") return { input: 0, output: 0 };
  return PRICES[`${provider}:${model}`] ?? null;
}
