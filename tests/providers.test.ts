import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withRetry, humanizeError, isRetryable } from "@/server/providers/retry";
import { computeCost } from "@/server/services/costs/calc";
import { AnthropicProvider } from "@/server/providers/llm/anthropic";
import { OpenAIImageProvider, openAISize } from "@/server/providers/image/openai";
import { GeminiImageProvider, geminiAspect } from "@/server/providers/image/gemini";
import { getImageProvider, getLLM } from "@/server/providers";
import { testDb } from "./helpers";

const ENV_KEYS = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("retry & errors", () => {
  it("retries on 429/5xx with backoff, not on 400", async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw Object.assign(new Error("rate"), { status: 429 });
        return "ok";
      },
      { sleep: async () => {} },
    );
    expect(r).toBe("ok");
    expect(calls).toBe(3);
    let bad = 0;
    await expect(
      withRetry(
        async () => {
          bad++;
          throw Object.assign(new Error("bad"), { status: 400 });
        },
        { sleep: async () => {} },
      ),
    ).rejects.toThrow("bad");
    expect(bad).toBe(1);
    expect(isRetryable(Object.assign(new Error("x"), { status: 503 }))).toBe(true);
  });
  it("gives clear Romanian messages", () => {
    expect(humanizeError(Object.assign(new Error("x"), { status: 401 }), "OpenAI")).toContain("cheia API e invalidă");
    expect(humanizeError(Object.assign(new Error("x"), { status: 429 }), "Gemini")).toContain("prea multe cereri");
  });
});

describe("costs", () => {
  it("gpt-image-2: text in $5/1M, image in $8/1M, image out $30/1M", () => {
    expect(computeCost("openai", "gpt-image-2", { inputTextTokens: 1_000_000, inputImageTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(43);
    expect(computeCost("openai", "gpt-image-2", { inputTokens: 200, outputTokens: 4000 })).toBeCloseTo(0.001 + 0.12, 5);
  });
  it("claude sonnet 5.5 $2/$10; mock and unknown models cost 0", () => {
    expect(computeCost("anthropic", "claude-sonnet-5-5", { inputTokens: 1_000_000, outputTokens: 100_000 })).toBeCloseTo(3);
    expect(computeCost("mock", "mock", { inputTokens: 1e9 })).toBe(0);
    expect(computeCost("openai", "unknown", { inputTokens: 1e6 })).toBe(0);
  });
});

describe("provider selection", () => {
  it("falls back to mock without keys", async () => {
    const db = await testDb();
    expect(getLLM().id).toBe("mock");
    expect((await getImageProvider(db, "openai")).id).toBe("mock");
    expect((await getImageProvider(db, "gemini")).id).toBe("mock");
  });
  it("uses the real provider when its key exists", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const db = await testDb();
    expect(getLLM().id).toBe("anthropic");
    expect((await getImageProvider(db, "openai")).id).toBe("openai");
  });
  it("maps aspects to supported sizes", () => {
    expect(openAISize("4:5")).toBe("1024x1536");
    expect(openAISize("1.91:1")).toBe("1536x1024");
    expect(geminiAspect("1.91:1")).toBe("16:9");
    expect(geminiAspect("4:5")).toBe("4:5");
  });
});

describe("real providers with mocked HTTP", () => {
  it("Anthropic: structured copy output validated with Zod", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const payload = {
      variants: [{ index: 0, angle: "oferta", headline: "Reducere 40% azi", cta: "Programează-te", visualPrompt: "A bright salon. No text.", negativeSpace: "bottom", rationale: "Ofertă clară." }],
    };
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain("/v1/messages");
      const body = JSON.parse(String(init?.body)) as { model: string; output_config: { format: { type: string } } };
      expect(body.model).toBe("claude-sonnet-5-5");
      expect(body.output_config.format.type).toBe("json_schema");
      return jsonResponse({
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: [{ type: "text", text: JSON.stringify(payload) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 300 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const p = new AnthropicProvider();
    const r = await p.writeCopy({
      contextPrompt: "ctx",
      variantCount: 1,
      angles: [],
      brief: { message: "Reducere 40%", cta: "", notes: "" },
      industry: "beauty",
      palette: [],
      style: null,
      negativeSpaceHint: "bottom",
      brandPhotos: [],
    });
    expect(r.data.variants[0]!.headline).toBe("Reducere 40% azi");
    expect(r.usage).toEqual({ inputTokens: 1200, outputTokens: 300 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Anthropic: invalid JSON is retried once, then fails with a clear error", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const fetchMock = vi.fn(async () =>
      jsonResponse({ id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: '{"angles": []}' }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(new AnthropicProvider().proposeAngles({ contextPrompt: "c", brief: { message: "m", cta: "", notes: "" }, industry: "food" })).rejects.toThrow(/JSON invalid/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("OpenAI: generate returns PNG bytes and token usage; edits endpoint when references exist", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        urls.push(String(url));
        return jsonResponse({ created: 1, data: [{ b64_json: PNG_B64 }], usage: { input_tokens: 50, output_tokens: 1000, total_tokens: 1050, input_tokens_details: { image_tokens: 0, text_tokens: 50 } } });
      }),
    );
    const p = new OpenAIImageProvider();
    const r = await p.generate({ prompt: "a burger", aspect: "4:5" });
    expect(r.image.subarray(1, 4).toString()).toBe("PNG");
    expect(r.usage?.outputTokens).toBe(1000);
    await p.generate({ prompt: "a burger", aspect: "1:1", referenceImages: [{ data: Buffer.from(PNG_B64, "base64"), mimeType: "image/png" }] });
    const api = urls.filter((u) => u.startsWith("http"));
    expect(api[0]).toContain("/images/generations");
    expect(api[1]).toContain("/images/edits");
  });

  it("OpenAI: 5xx is retried, 401 gives a Romanian error", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "bad key" } }, 401)));
    await expect(new OpenAIImageProvider().generate({ prompt: "x", aspect: "4:5" })).rejects.toThrow(/cheia API e invalidă/);
  });

  it("Gemini: returns the inline image", async () => {
    process.env.GEMINI_API_KEY = "g-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        expect(String(url)).toContain("gemini-3-pro-image-preview");
        return jsonResponse({ candidates: [{ content: { role: "model", parts: [{ inlineData: { mimeType: "image/png", data: PNG_B64 } }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 1290 } });
      }),
    );
    const r = await new GeminiImageProvider().generate({ prompt: "x", aspect: "9:16" });
    expect(r.mimeType).toBe("image/png");
    expect(r.usage?.outputTokens).toBe(1290);
  });
});
