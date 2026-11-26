import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { feedbackInterpretationSchema, type FeedbackInterpretation } from "@/lib/types";
import { normalizeDeep } from "@/lib/diacritics";
import { SYSTEM_PROMPT, PROMPT_VERSION } from "../../prompts/system";
import { anglesPrompt } from "../../prompts/angles";
import { copyPrompt } from "../../prompts/copy";
import { feedbackPrompt } from "../../prompts/feedback";
import { visionPrompt } from "../../prompts/qa";
import { humanizeError, withRetry } from "../retry";
import {
  anglesOutputSchema,
  copyOutputSchema,
  visionOutputSchema,
  type AnglesInput,
  type AnglesOutput,
  type CopyInput,
  type CopyOutput,
  type FeedbackInput,
  type LLMProvider,
  type LLMResult,
  type VisionInput,
  type VisionOutput,
} from "./types";

type UserContent = Anthropic.Beta.Messages.BetaContentBlockParam[];

export class AnthropicProvider implements LLMProvider {
  id = "anthropic" as const;
  model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  private client: Anthropic | null = null;

  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  private get api() {
    // Our own retry/backoff wraps calls (withRetry), so the SDK retries are disabled.
    this.client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 0 });
    return this.client;
  }

  /**
   * One structured-output call: JSON validated against the Zod schema, one retry if it is invalid.
   * Uses the server-side refusal fallback (beta) so a classifier refusal falls back to another model.
   */
  private async structured<S extends z.ZodType>(schema: S, content: UserContent, maxTokens = 8000): Promise<LLMResult<z.infer<S>>> {
    let inputTokens = 0;
    let outputTokens = 0;
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const extra: UserContent = attempt === 0 ? [] : [{ type: "text", text: `Răspunsul anterior nu a fost valid (${lastError}). Respectă exact schema JSON.` }];
      const res = await withRetry(() =>
        this.api.beta.messages.parse({
          model: this.model,
          max_tokens: maxTokens,
          system: SYSTEM_PROMPT,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { format: betaZodOutputFormat(schema), effort: "medium" },
          messages: [{ role: "user", content: [...content, ...extra] }],
        }),
      );
      inputTokens += res.usage.input_tokens;
      outputTokens += res.usage.output_tokens;
      if (res.stop_reason === "refusal") throw new Error("Claude a refuzat cererea (filtru de siguranță). Reformulează brief-ul.");
      if (res.stop_reason === "max_tokens") {
        lastError = "răspuns trunchiat";
        continue;
      }
      const parsed = schema.safeParse(res.parsed_output);
      if (parsed.success) {
        return { data: normalizeDeep(parsed.data) as z.infer<S>, usage: { inputTokens, outputTokens }, promptVersion: PROMPT_VERSION, model: this.model };
      }
      lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }
    throw new Error(`Claude a întors un JSON invalid de două ori: ${lastError}`);
  }

  async proposeAngles(input: AnglesInput): Promise<LLMResult<AnglesOutput>> {
    return this.structured(anglesOutputSchema, [{ type: "text", text: anglesPrompt(input) }], 4000);
  }

  async writeCopy(input: CopyInput): Promise<LLMResult<CopyOutput>> {
    return this.structured(copyOutputSchema, [{ type: "text", text: copyPrompt(input) }], 12000);
  }

  async interpretFeedback(input: FeedbackInput): Promise<LLMResult<FeedbackInterpretation>> {
    return this.structured(feedbackInterpretationSchema, [{ type: "text", text: feedbackPrompt(input) }], 4000);
  }

  async reviewImage(input: VisionInput): Promise<LLMResult<VisionOutput>> {
    const mediaType = (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(input.image.mimeType) ? input.image.mimeType : "image/png") as
      | "image/png"
      | "image/jpeg"
      | "image/webp"
      | "image/gif";
    return this.structured(
      visionOutputSchema,
      [
        { type: "image", source: { type: "base64", media_type: mediaType, data: input.image.data.toString("base64") } },
        { type: "text", text: visionPrompt(input) },
      ],
      3000,
    );
  }

  async ping() {
    try {
      await this.api.messages.create({ model: this.model, max_tokens: 16, messages: [{ role: "user", content: "ping" }] });
    } catch (e) {
      throw new Error(humanizeError(e, "Anthropic"));
    }
  }
}
