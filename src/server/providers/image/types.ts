export type ImageAspect = "4:5" | "1:1" | "9:16" | "16:9" | "1.91:1";

export type ImageGenerateInput = {
  prompt: string;
  aspect: ImageAspect;
  referenceImages?: { data: Buffer; mimeType: string }[];
  quality?: "low" | "medium" | "high";
};

export type ImageGenerateResult = {
  image: Buffer;
  mimeType: string;
  usage?: { inputTokens?: number; outputTokens?: number; inputImageTokens?: number; inputTextTokens?: number };
  model: string;
  raw?: unknown;
};

export interface ImageProvider {
  id: "openai" | "gemini" | "mock";
  model: string;
  isConfigured(): boolean;
  generate(input: ImageGenerateInput): Promise<ImageGenerateResult>;
  ping(): Promise<void>;
}

export function aspectForFormat(formatKey: string): ImageAspect {
  switch (formatKey) {
    case "feed_4x5":
      return "4:5";
    case "feed_1x1":
      return "1:1";
    case "story_9x16":
      return "9:16";
    case "landscape_191":
    case "fb_cover":
      return "1.91:1";
    default:
      return "4:5";
  }
}

export function aspectRatioValue(a: ImageAspect): number {
  const [w, h] = a.split(":").map(Number) as [number, number];
  return w / h;
}
