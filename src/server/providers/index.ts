import { eq } from "drizzle-orm";
import type { DB } from "../db/connect";
import { appSettings } from "../db/schema";
import type { LLMProvider } from "./llm/types";
import type { ImageProvider } from "./image/types";
import { MockLLMProvider } from "./llm/mock";
import { MockImageProvider } from "./image/mock";
import { AnthropicProvider } from "./llm/anthropic";
import { OpenAIImageProvider } from "./image/openai";
import { GeminiImageProvider } from "./image/gemini";

export type ImageProviderId = "openai" | "gemini" | "mock";

/** Overridable in tests. */
const overrides: { llm?: LLMProvider; image?: ImageProvider } = {};
export function setProviderOverrides(o: { llm?: LLMProvider; image?: ImageProvider }) {
  overrides.llm = o.llm;
  overrides.image = o.image;
}

/** Claude when ANTHROPIC_API_KEY exists, mock otherwise. */
export function getLLM(): LLMProvider {
  if (overrides.llm) return overrides.llm;
  const a = new AnthropicProvider();
  return a.isConfigured() ? a : new MockLLMProvider();
}

export function imageProviderById(id: ImageProviderId): ImageProvider {
  if (id === "openai") return new OpenAIImageProvider();
  if (id === "gemini") return new GeminiImageProvider();
  return new MockImageProvider();
}

export async function getDefaultImageProviderId(db: DB): Promise<ImageProviderId> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "defaultImageProvider"));
  const v = (row?.value as string | undefined) ?? process.env.DEFAULT_IMAGE_PROVIDER ?? "openai";
  return v === "gemini" || v === "mock" ? v : "openai";
}

export async function setDefaultImageProviderId(db: DB, id: ImageProviderId) {
  await db
    .insert(appSettings)
    .values({ key: "defaultImageProvider", value: id })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: id } });
}

/** Requested (or default) image provider; falls back to mock when its key is missing. */
export async function getImageProvider(db: DB, requested?: ImageProviderId): Promise<ImageProvider> {
  if (overrides.image) return overrides.image;
  const id = requested ?? (await getDefaultImageProviderId(db));
  const p = imageProviderById(id);
  return p.isConfigured() ? p : new MockImageProvider();
}
