import type { Angle, AngleType, FeedbackInterpretation } from "@/lib/types";
import { normalizeDiacritics } from "@/lib/diacritics";
import type {
  AnglesInput,
  AnglesOutput,
  CopyInput,
  CopyOutput,
  FeedbackInput,
  LLMProvider,
  LLMResult,
  VisionInput,
  VisionOutput,
} from "./types";

export const MOCK_PROMPT_VERSION = "mock-1";

const usage = { inputTokens: 0, outputTokens: 0 };
const result = <T>(data: T): LLMResult<T> => ({ data, usage, promptVersion: MOCK_PROMPT_VERSION, model: "mock" });

const MONTHS = "ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie";

export function extractOfferFacts(message: string) {
  const m = normalizeDiacritics(message);
  const percent = m.match(/-?\s?(\d{1,2})\s?%/)?.[1];
  const price = m.match(/(\d+[.,]?\d*)\s?(lei|ron|€|eur)/i);
  const date = m.match(new RegExp(`(\\d{1,2})\\s+(${MONTHS})`, "i"));
  const ctaMatch = m.match(/cta[:\s]+([^,.;\n]+)/i);
  // topic: text after "la" (e.g. "Reducere 40% la epilare definitivă zona X") up to a comma
  const topic =
    m.match(/\bla\s+([^,.;\n]+?)(?=,|\.|;|\s+doar|\s+până|\s+cta|$)/i)?.[1]?.trim() ??
    m.split(/[,.;\n]/)[0]!.split(/\s+/).slice(0, 4).join(" ");
  return {
    percent: percent ? `-${percent}%` : undefined,
    price: price ? `${price[1]} ${price[2]!.toLowerCase() === "ron" ? "lei" : price[2]}` : undefined,
    date: date ? `${date[1]} ${date[2]!.toLowerCase()}` : undefined,
    cta: ctaMatch?.[1]?.trim(),
    topic: topic.length > 40 ? topic.split(/\s+/).slice(0, 4).join(" ") : topic,
  };
}

function capitalize(s: string) {
  return s ? s[0]!.toLocaleUpperCase("ro-RO") + s.slice(1) : s;
}

function words(s: string, n: number) {
  return s.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

function defaultCta(industry: string) {
  if (industry === "food") return "Comandă acum";
  if (industry === "beauty") return "Programează-te";
  if (industry === "hospitality") return "Rezervă acum";
  return "Află mai multe";
}

export function mockAngles(brief: { message: string; cta: string }, industry: string): Angle[] {
  const f = extractOfferFacts(brief.message);
  const cta = capitalize(brief.cta || f.cta || defaultCta(industry));
  const topic = f.topic;
  const deal = f.percent ?? f.price;
  const list: { type: AngleType; headline: string; sub: string; why: string }[] = [
    {
      type: "oferta",
      headline: deal ? `${deal} la ${words(topic, 4)}` : capitalize(words(topic, 6)),
      sub: f.date ? `Doar până pe ${f.date}` : "Ofertă valabilă pentru o perioadă limitată",
      why: "Oferta concretă, spusă direct, pentru cine compară deja prețuri.",
    },
    {
      type: "durere",
      headline: industry === "food" ? "Ți-e foame de ceva bun?" : "Gata cu soluțiile temporare",
      sub: capitalize(words(topic, 6)) + (deal ? `, acum ${deal}` : ""),
      why: "Pornește de la problema clientului, apoi oferă soluția.",
    },
    {
      type: "rezultat",
      headline: industry === "food" ? "Gust de care îți amintești" : "Rezultate pe care le vezi",
      sub: capitalize(words(topic, 6)),
      why: "Accent pe beneficiul final, nu pe procedură.",
    },
    {
      type: "urgenta",
      headline: f.date ? `Doar până pe ${f.date}` : "Locuri limitate",
      sub: deal ? `${deal} la ${words(topic, 5)}` : capitalize(words(topic, 6)),
      why: "Termenul limită împinge decizia.",
    },
  ];
  return list.map((a, i) => ({
    id: `a${i + 1}`,
    type: a.type,
    headline: normalizeDiacritics(a.headline),
    subheadline: normalizeDiacritics(a.sub),
    cta,
    why: a.why,
  }));
}

export function mockCopy(input: CopyInput): CopyOutput {
  const f = extractOfferFacts(input.brief.message);
  const angles = input.angles.length ? input.angles : mockAngles(input.brief, input.industry);
  const hexes = input.palette.map((p) => `${p.name} ${p.hex}`).join(", ");
  const rulesCount = (input.contextPrompt.match(/^- \[/gm) ?? []).length;
  const variants = Array.from({ length: input.variantCount }, (_, i) => {
    const a = angles[i % angles.length]!;
    const usePhoto = input.brandPhotos.length > 0 && input.variantCount >= 3 && i === input.variantCount - 1;
    const visual = [
      input.style?.visualPrompt ?? "Clean, bright commercial photograph related to the offer.",
      `Subject: ${f.topic}.`,
      `Colour mood from the brand palette: ${hexes || "neutral"}.`,
      `Leave calm empty space at the ${input.negativeSpaceHint} for text.`,
      input.style?.avoid ? `Avoid: ${input.style.avoid}` : "",
      "No text, no letters, no logos, no watermarks.",
      `Variation ${i + 1}.`,
    ]
      .filter(Boolean)
      .join(" ");
    return {
      index: i,
      angle: a.type,
      headline: a.headline,
      subheadline: a.subheadline,
      cta: a.cta,
      extra: { price: f.percent ?? f.price, badge: f.date?.toLocaleUpperCase("ro-RO") },
      visualPrompt: visual,
      negativeSpace: input.negativeSpaceHint,
      useBrandPhotoKey: usePhoto ? input.brandPhotos[i % input.brandPhotos.length]!.key : undefined,
      rationale: `Unghi „${a.type}”: ${a.why}${rulesCount ? ` Am ținut cont de ${rulesCount} reguli din context.` : ""}${usePhoto ? " Folosește o poză reală din brand kit." : ""} (mock)`,
    };
  });
  return { variants };
}

const RULE_TRIGGER = /(^|[\s,(„"])(nu|evită|evitați|evita|mereu|niciodată|întotdeauna)(?=[\s,.;:!?)”"]|$)/i;

function tokens(s: string) {
  return new Set(
    normalizeDiacritics(s)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}
export function similarity(a: string, b: string) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function mockInterpretFeedback(input: FeedbackInput): FeedbackInterpretation {
  const sentences = normalizeDiacritics(input.comment)
    .split(/[.!?;\n]+|\s+și\s+(?=nu\b|evit|mereu|niciodat|întotdeauna)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  const rules: FeedbackInterpretation["rules"] = [];
  const oneOffs: string[] = [];
  for (const s of sentences) {
    if (!RULE_TRIGGER.test(s)) {
      oneOffs.push(s);
      continue;
    }
    const lower = s.toLowerCase();
    const formats: string[] = [];
    if (/\bstor(y|ies)\b/.test(lower)) formats.push("story_9x16");
    if (/\bfeed\b/.test(lower)) formats.push("feed_4x5", "feed_1x1");
    if (/\bcover\b|copert/.test(lower)) formats.push("fb_cover");
    const styles = input.availableStyles.filter((st) => lower.includes(st.toLowerCase()));
    const text = capitalize(s.replace(/\s+/g, " ")).replace(/[.\s]*$/, ".");
    const match = input.existingRules.map((r) => ({ r, sim: similarity(r.text, text) })).sort((a, b) => b.sim - a.sim)[0];
    rules.push({
      text,
      scope: { ...(formats.length ? { formats } : {}), ...(styles.length ? { styles } : {}) },
      matchesExistingRuleId: match && match.sim >= 0.5 ? match.r.id : undefined,
      isAgencyWide: /toți clienții|la toți|pentru toți|niciodată/i.test(s),
    });
  }
  const parts: string[] = [];
  rules.forEach((r) => parts.push(`„${r.text.replace(/\.$/, "")}”: ${r.matchesExistingRuleId ? "confirmă o regulă existentă" : "regulă nouă în probă"}`));
  oneOffs.forEach((o) => parts.push(`„${capitalize(o)}”: doar pentru bannerul ăsta`));
  const n = parts.length;
  const summary = n
    ? `Am înțeles ${n === 1 ? "un lucru" : `${n} lucruri`}: ${parts.map((p, i) => (n > 1 ? `(${i + 1}) ${p}` : p)).join("; ")}.`
    : "Nu am găsit nimic de aplicat în comentariu.";
  return { oneOff: oneOffs.length ? { instruction: oneOffs.map(capitalize).join(". ") } : null, rules, summary };
}

export class MockLLMProvider implements LLMProvider {
  id = "mock" as const;
  model = "mock";
  isConfigured() {
    return true;
  }
  async proposeAngles(input: AnglesInput): Promise<LLMResult<AnglesOutput>> {
    return result({ angles: mockAngles(input.brief, input.industry) });
  }
  async writeCopy(input: CopyInput): Promise<LLMResult<CopyOutput>> {
    return result(mockCopy(input));
  }
  async interpretFeedback(input: FeedbackInput): Promise<LLMResult<FeedbackInterpretation>> {
    return result(mockInterpretFeedback(input));
  }
  async reviewImage(input: VisionInput): Promise<LLMResult<VisionOutput>> {
    const issues: VisionOutput["issues"] = [];
    const text = `${input.expectedCopy.headline} ${input.expectedCopy.subheadline ?? ""}`.toLowerCase();
    if (input.industry === "beauty" && /(înainte|before|după|after|kilogram|slăb|celulit)/.test(text)) {
      issues.push({ severity: "warning", message: "Posibil conflict cu politica Meta (before/after sau mesaje despre corp) în nișa beauty. (mock)" });
    }
    return result({ issues });
  }
  async ping() {}
}
