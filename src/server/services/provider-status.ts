import type { DB } from "../db/connect";
import { AnthropicProvider } from "../providers/llm/anthropic";
import { OpenAIImageProvider } from "../providers/image/openai";
import { GeminiImageProvider } from "../providers/image/gemini";
import { lastCallFor, loggedCall } from "./llm-log";
import { priceFor } from "./costs/prices";

export type ProviderKey = "anthropic" | "openai" | "gemini";

export type ProviderStatus = {
  key: ProviderKey;
  label: string;
  kind: "llm" | "image";
  model: string;
  envKey: string;
  state: "active" | "mock" | "error";
  lastError: string | null;
  lastCallAt: string | null;
  priceTodo: boolean;
  priceNote: string | null;
};

function make(key: ProviderKey) {
  if (key === "anthropic") return new AnthropicProvider();
  if (key === "openai") return new OpenAIImageProvider();
  return new GeminiImageProvider();
}

const META: Record<ProviderKey, { label: string; kind: "llm" | "image"; envKey: string }> = {
  anthropic: { label: "Claude (copy, unghiuri, feedback, QA vision)", kind: "llm", envKey: "ANTHROPIC_API_KEY" },
  openai: { label: "OpenAI gpt-image (imagini)", kind: "image", envKey: "OPENAI_API_KEY" },
  gemini: { label: "Gemini Nano Banana Pro (imagini)", kind: "image", envKey: "GEMINI_API_KEY" },
};

/** active / mock (missing key) / error on the last call. */
export async function providerStatuses(db: DB): Promise<ProviderStatus[]> {
  const out: ProviderStatus[] = [];
  for (const key of ["anthropic", "openai", "gemini"] as const) {
    const p = make(key);
    const last = await lastCallFor(db, key);
    const price = priceFor(key, p.model);
    out.push({
      key,
      ...META[key],
      model: p.model,
      state: !p.isConfigured() ? "mock" : last && !last.ok ? "error" : "active",
      lastError: last && !last.ok ? last.error : null,
      lastCallAt: last?.createdAt.toISOString() ?? null,
      priceTodo: !price || !!price.todo,
      priceNote: price?.note ?? (!price ? "Modelul nu e în tabelul de prețuri (cost 0)." : null),
    });
  }
  return out;
}

/** „Test conexiune”: a cheap call (models endpoint / 16-token message), logged as purpose `test`. */
export async function testProvider(db: DB, key: ProviderKey): Promise<{ ok: boolean; message: string }> {
  const p = make(key);
  if (!p.isConfigured()) return { ok: false, message: `Lipsește ${META[key].envKey}. Providerul rulează în mod mock.` };
  try {
    await loggedCall(db, { purpose: "test", provider: key, model: p.model }, () => p.ping(), () => ({}));
    return { ok: true, message: `Conexiune OK (${p.model}).` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
