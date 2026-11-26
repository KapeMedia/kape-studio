import { z } from "zod";
import { angleSchema, type Angle, type FeedbackInterpretation } from "@/lib/types";

export type LLMUsage = { inputTokens: number; outputTokens: number };
export type LLMResult<T> = { data: T; usage: LLMUsage; promptVersion: string; model: string };

// ---------- angles ----------
export const anglesOutputSchema = z.object({ angles: z.array(angleSchema).min(1).max(6) });
export type AnglesOutput = z.infer<typeof anglesOutputSchema>;
export type AnglesInput = {
  contextPrompt: string;
  brief: { message: string; cta: string; notes: string };
  industry: string;
};

// ---------- copy + visual direction ----------
export const copyVariantSchema = z.object({
  index: z.number().int(),
  angle: z.string(),
  headline: z.string().min(1),
  subheadline: z.string().optional(),
  cta: z.string().min(1),
  extra: z.object({ price: z.string().optional(), badge: z.string().optional() }).optional(),
  visualPrompt: z.string().min(1),
  negativeSpace: z.enum(["top", "bottom", "left", "right", "center"]),
  useBrandPhotoKey: z.string().optional(),
  rationale: z.string(),
});
export const copyOutputSchema = z.object({ variants: z.array(copyVariantSchema).min(1) });
export type CopyVariant = z.infer<typeof copyVariantSchema>;
export type CopyOutput = z.infer<typeof copyOutputSchema>;
export type CopyInput = {
  contextPrompt: string;
  variantCount: number;
  angles: Angle[];
  brief: { message: string; cta: string; notes: string };
  industry: string;
  palette: { role: string; hex: string; name: string }[];
  style: { name: string; visualPrompt: string; avoid: string; copyGuidance: string; textMode: "overlay" | "full_ai" } | null;
  negativeSpaceHint: "top" | "bottom" | "left" | "right" | "center";
  brandPhotos: { key: string; name: string }[];
};

// ---------- feedback ----------
export type FeedbackInput = {
  comment: string;
  variant: { headline: string; subheadline?: string; cta: string; style: string | null; format: string };
  existingRules: { id: string; text: string; status: string }[];
  availableFormats: string[];
  availableStyles: string[];
};

// ---------- vision QA ----------
export const visionOutputSchema = z.object({
  issues: z.array(z.object({ severity: z.enum(["warning", "error"]), message: z.string() })),
});
export type VisionOutput = z.infer<typeof visionOutputSchema>;
export type VisionInput = {
  image: { data: Buffer; mimeType: string };
  expectedCopy: { headline: string; subheadline?: string; cta: string };
  rules: string[];
  industry: string;
  textMode: "overlay" | "full_ai";
};

export interface LLMProvider {
  id: "anthropic" | "mock";
  model: string;
  isConfigured(): boolean;
  proposeAngles(input: AnglesInput): Promise<LLMResult<AnglesOutput>>;
  writeCopy(input: CopyInput): Promise<LLMResult<CopyOutput>>;
  interpretFeedback(input: FeedbackInput): Promise<LLMResult<FeedbackInterpretation>>;
  reviewImage(input: VisionInput): Promise<LLMResult<VisionOutput>>;
  ping(): Promise<void>;
}
