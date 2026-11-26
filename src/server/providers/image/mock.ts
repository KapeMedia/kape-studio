import crypto from "node:crypto";
import { aspectRatioValue, type ImageGenerateInput, type ImageGenerateResult, type ImageProvider } from "./types";

function seeded(seed: string) {
  let h = crypto.createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

/** Deterministic placeholder image: brand-colour gradient + soft shapes + small "MOCK" label. */
export async function renderMockImage(prompt: string, aspect: ImageGenerateInput["aspect"]): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const ratio = aspectRatioValue(aspect);
  const width = ratio >= 1 ? 1200 : Math.round(1080 * ratio * (ratio < 0.7 ? 1 : 1));
  const height = Math.round(width / ratio);
  const rand = seeded(prompt);
  const hexes = Array.from(new Set(prompt.match(/#[0-9a-fA-F]{6}/g) ?? [])).slice(0, 5);
  const palette = hexes.length >= 2 ? hexes : ["#94A3B8", "#475569", "#CBD5E1"];
  const pick = () => palette[Math.floor(rand() * palette.length)]!;
  const c1 = pick();
  let c2 = pick();
  if (c2 === c1) c2 = palette[(palette.indexOf(c1) + 1) % palette.length]!;
  const angle = Math.floor(rand() * 360);
  const shapes = Array.from({ length: 6 }, () => {
    const r = (0.08 + rand() * 0.25) * width;
    return `<circle cx="${(rand() * width).toFixed(0)}" cy="${(rand() * height).toFixed(0)}" r="${r.toFixed(0)}" fill="${pick()}" opacity="${(0.15 + rand() * 0.35).toFixed(2)}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <filter id="b"><feGaussianBlur stdDeviation="${Math.round(width / 40)}"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g filter="url(#b)">${shapes}</g>
  <rect x="${width - 120}" y="${height - 44}" width="104" height="30" rx="6" fill="rgba(0,0,0,0.35)"/>
  <text x="${width - 68}" y="${height - 23}" font-family="sans-serif" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">MOCK</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export class MockImageProvider implements ImageProvider {
  id = "mock" as const;
  model = "mock";
  constructor(private delay: [number, number] = [300, 800]) {}
  isConfigured() {
    return true;
  }
  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    const [a, b] = this.delay;
    const wait = a + (crypto.createHash("md5").update(input.prompt).digest().readUInt8(0) / 255) * (b - a);
    await new Promise((r) => setTimeout(r, wait));
    return { image: await renderMockImage(input.prompt, input.aspect), mimeType: "image/png", model: "mock" };
  }
  async ping() {}
}
