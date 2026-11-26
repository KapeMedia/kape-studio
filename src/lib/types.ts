import { z } from "zod";
import { BRAND_ROLES, type FormatKey } from "./template-types";

export const brandColorSchema = z.object({
  name: z.string().max(60),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex invalid (ex: #1A2B3C)"),
  role: z.enum(BRAND_ROLES),
});
export type BrandColor = z.infer<typeof brandColorSchema>;

export type SafeZone = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** Rectangles (px) that must stay free of text/logo, e.g. profile picture on FB cover. */
  avoidRects?: { x: number; y: number; w: number; h: number }[];
};

export const ANGLE_TYPES = ["oferta", "durere", "rezultat", "social_proof", "urgenta", "altul"] as const;
export type AngleType = (typeof ANGLE_TYPES)[number];

export const angleSchema = z.object({
  id: z.string(),
  type: z.enum(ANGLE_TYPES),
  headline: z.string(),
  subheadline: z.string().optional(),
  cta: z.string(),
  why: z.string(),
});
export type Angle = z.infer<typeof angleSchema>;

export const briefSchema = z.object({
  message: z.string().trim().min(3, "Scrie mesajul / oferta"),
  cta: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  formats: z.array(z.string()).min(1).default(["feed_4x5"]),
  styleId: z.string().nullable().default(null), // null = „Alege tu”
  variantCount: z.number().int().min(1).max(8).default(4),
  referenceKeys: z.array(z.string()).max(4).default([]),
  imageProvider: z.enum(["openai", "gemini", "mock"]).optional(),
  angles: z.array(angleSchema).default([]),
});
export type BriefInput = z.infer<typeof briefSchema>;

export type VariantCopy = {
  headline: string;
  subheadline?: string;
  cta: string;
  extra?: { price?: string; badge?: string };
};

export type BrainScope = { formats?: string[]; styles?: string[] };
export type BrainSource = {
  feedbackId?: string;
  variantId?: string;
  authorId?: string;
  authorName?: string;
  quote?: string;
  date?: string;
};

export type ContextRuleRef = {
  id: string;
  text: string;
  status: "trial" | "active";
  level: "agency" | "client";
  pinned: boolean;
  sourceQuote?: string;
  sourceAuthor?: string;
  sourceDate?: string;
};

export type ContextExample = {
  variantId: string;
  kind: "approved" | "rejected";
  headline: string;
  subheadline?: string;
  cta: string;
  visual: string;
  reason?: string;
};

export type ContextSnapshot = {
  role: string;
  agencyRules: ContextRuleRef[];
  formatInstructions: { key: string; label: string; text: string }[];
  style: {
    id: string;
    name: string;
    versionId: string;
    version: number;
    description: string;
    copyGuidance: string;
    visualPrompt: string;
    avoid: string;
    textMode: "overlay" | "full_ai";
  } | null;
  client: {
    name: string;
    industry: string;
    description: string;
    audience: string;
    tone: string;
    dos: string;
    donts: string;
    activeOffers: string;
    colors: { name: string; hex: string; role: string }[];
  };
  clientRules: ContextRuleRef[];
  trialRules: ContextRuleRef[];
  facts: ContextRuleRef[];
  examples: ContextExample[];
  brief: {
    message: string;
    cta: string;
    notes: string;
    formats: string[];
    angles: { type: string; headline: string; subheadline?: string; cta: string }[];
  };
  priorityRule: string;
  usedEntryIds: string[];
  prompt: string;
  builtAt: string;
};

export type QaSeverity = "ok" | "warning" | "error";
export type QaIssue = {
  code:
    | "safe_zone"
    | "text_overflow"
    | "min_font"
    | "contrast"
    | "logo_present"
    | "diacritics"
    | "vision";
  severity: Exclude<QaSeverity, "ok">;
  message: string;
  formatKey?: string;
  layerId?: string;
};
export type QaResult = {
  status: QaSeverity;
  issues: QaIssue[];
  checkedAt: string;
  vision: "skipped" | "mock" | "done" | "error";
};

export const feedbackInterpretationSchema = z.object({
  oneOff: z.object({ instruction: z.string() }).nullable(),
  rules: z.array(
    z.object({
      text: z.string(),
      scope: z.object({
        formats: z.array(z.string()).optional(),
        styles: z.array(z.string()).optional(),
      }),
      matchesExistingRuleId: z.string().optional(),
      isAgencyWide: z.boolean(),
    }),
  ),
  summary: z.string(),
});
export type FeedbackInterpretation = z.infer<typeof feedbackInterpretationSchema>;

export type { FormatKey };
