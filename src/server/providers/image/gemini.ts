import { GoogleGenAI } from "@google/genai";
import { humanizeError, withRetry } from "../retry";
import { aspectRatioValue, type ImageGenerateInput, type ImageGenerateResult, type ImageProvider } from "./types";

const SUPPORTED = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

/** Nearest aspect ratio Gemini supports. */
export function geminiAspect(aspect: ImageGenerateInput["aspect"]): string {
  if (SUPPORTED.includes(aspect)) return aspect;
  const target = aspectRatioValue(aspect);
  return SUPPORTED.map((a) => ({ a, d: Math.abs(aspectRatioValue(a as ImageGenerateInput["aspect"]) - target) })).sort((x, y) => x.d - y.d)[0]!.a;
}

export class GeminiImageProvider implements ImageProvider {
  id = "gemini" as const;
  model = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";
  private client: GoogleGenAI | null = null;

  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  }

  private get api() {
    this.client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return this.client;
  }

  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    try {
      const res = await withRetry(() =>
        this.api.models.generateContent({
          model: this.model,
          contents: [
            {
              role: "user",
              parts: [
                ...(input.referenceImages ?? []).slice(0, 4).map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data.toString("base64") } })),
                { text: input.prompt },
              ],
            },
          ],
          config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: geminiAspect(input.aspect) }, httpOptions: { timeout: 180_000 } },
        }),
      );
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("Gemini nu a întors nicio imagine (posibil blocată de filtrele de siguranță).");
      return {
        image: Buffer.from(part.inlineData.data, "base64"),
        mimeType: part.inlineData.mimeType ?? "image/png",
        model: this.model,
        usage: { inputTokens: res.usageMetadata?.promptTokenCount, outputTokens: res.usageMetadata?.candidatesTokenCount },
      };
    } catch (e) {
      throw new Error(humanizeError(e, "Gemini"));
    }
  }

  async ping() {
    try {
      await this.api.models.get({ model: this.model });
    } catch (e) {
      throw new Error(humanizeError(e, "Gemini"));
    }
  }
}
