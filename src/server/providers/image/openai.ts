import OpenAI, { toFile } from "openai";
import { humanizeError, withRetry } from "../retry";
import { aspectRatioValue, type ImageGenerateInput, type ImageGenerateResult, type ImageProvider } from "./types";

/** Closest size supported by gpt-image for the requested aspect (the template crops with `cover`). */
export function openAISize(aspect: ImageGenerateInput["aspect"]): "1024x1024" | "1024x1536" | "1536x1024" {
  const r = aspectRatioValue(aspect);
  if (r < 0.9) return "1024x1536";
  if (r > 1.1) return "1536x1024";
  return "1024x1024";
}

export class OpenAIImageProvider implements ImageProvider {
  id = "openai" as const;
  model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  private client: OpenAI | null = null;

  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  }

  private get api() {
    this.client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 180_000, maxRetries: 0 });
    return this.client;
  }

  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    const size = openAISize(input.aspect);
    const quality = input.quality ?? "medium";
    try {
      const res = await withRetry(async () => {
        if (input.referenceImages?.length) {
          const files = await Promise.all(
            input.referenceImages.slice(0, 4).map((r, i) => toFile(r.data, `ref-${i}.${r.mimeType.split("/")[1] ?? "png"}`, { type: r.mimeType })),
          );
          return this.api.images.edit({ model: this.model, prompt: input.prompt, image: files, size, quality, n: 1 });
        }
        return this.api.images.generate({ model: this.model, prompt: input.prompt, size, quality, n: 1 });
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI nu a întors nicio imagine.");
      const u = res.usage;
      return {
        image: Buffer.from(b64, "base64"),
        mimeType: "image/png",
        model: this.model,
        usage: u
          ? {
              inputTokens: u.input_tokens,
              outputTokens: u.output_tokens,
              inputImageTokens: u.input_tokens_details?.image_tokens,
              inputTextTokens: u.input_tokens_details?.text_tokens,
            }
          : undefined,
      };
    } catch (e) {
      throw new Error(humanizeError(e, "OpenAI"));
    }
  }

  async ping() {
    try {
      await this.api.models.retrieve(this.model);
    } catch (e) {
      throw new Error(humanizeError(e, "OpenAI"));
    }
  }
}
