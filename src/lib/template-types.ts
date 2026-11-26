import { z } from "zod";

export const FORMAT_KEYS = ["feed_4x5", "feed_1x1", "story_9x16", "landscape_191", "fb_cover"] as const;
export type FormatKey = (typeof FORMAT_KEYS)[number];
export const formatKeySchema = z.enum(FORMAT_KEYS);

export const BRAND_ROLES = ["primary", "secondary", "accent", "background", "text"] as const;
export type BrandRole = (typeof BRAND_ROLES)[number];

export const boxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().min(0),
  h: z.number().min(0),
});
export type Box = z.infer<typeof boxSchema>;

export const colorRefSchema = z.union([
  z.object({ brand: z.enum(BRAND_ROLES) }),
  z.object({ hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
]);
export type ColorRef = z.infer<typeof colorRefSchema>;

const imageLayer = z.object({
  id: z.string(),
  type: z.literal("image"),
  role: z.enum(["background", "photo"]),
  box: boxSchema,
  fit: z.enum(["cover", "contain"]),
  radius: z.number().optional(),
});
const overlayLayer = z.object({
  id: z.string(),
  type: z.literal("overlay"),
  box: boxSchema,
  fill: colorRefSchema,
  opacity: z.number().min(0).max(1),
  gradient: z.enum(["top", "bottom", "none"]).optional(),
});
export const TEXT_ROLES = ["headline", "subheadline", "cta", "body", "price", "badge"] as const;
export type TextRole = (typeof TEXT_ROLES)[number];
const textLayer = z.object({
  id: z.string(),
  type: z.literal("text"),
  role: z.enum(TEXT_ROLES),
  box: boxSchema,
  font: z.enum(["heading", "body"]),
  weight: z.number().optional(),
  maxSize: z.number().positive(),
  minSize: z.number().positive(),
  align: z.enum(["left", "center", "right"]),
  color: colorRefSchema,
  uppercase: z.boolean().optional(),
  lineHeight: z.number().optional(),
  background: z
    .object({
      fill: colorRefSchema,
      paddingX: z.number(),
      paddingY: z.number(),
      radius: z.number(),
    })
    .optional(),
});
const logoLayer = z.object({
  id: z.string(),
  type: z.literal("logo"),
  box: boxSchema,
  variant: z.enum(["auto", "default", "light"]),
});
const shapeLayer = z.object({
  id: z.string(),
  type: z.literal("shape"),
  shape: z.enum(["rect", "circle", "line"]),
  box: boxSchema,
  fill: colorRefSchema,
  radius: z.number().optional(),
});

export const layerSchema = z.discriminatedUnion("type", [
  imageLayer,
  overlayLayer,
  textLayer,
  logoLayer,
  shapeLayer,
]);
export type Layer = z.infer<typeof layerSchema>;
export type TextLayer = z.infer<typeof textLayer>;

export const layoutSchema = z.object({
  /** Canvas background colour (defaults to brand background). */
  background: colorRefSchema.optional(),
  layers: z.array(layerSchema),
});
export type Layout = z.infer<typeof layoutSchema>;

export const templateDefinitionSchema = z.object({
  layouts: z.partialRecord(formatKeySchema, layoutSchema).refine((l) => !!l.feed_4x5, {
    message: "Template-ul trebuie să aibă cel puțin layout pentru feed_4x5",
  }),
});
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;

// ---------- Resolved document (absolute px, hex colours, real text) ----------

type Rect = { x: number; y: number; w: number; h: number };

export type DocImageLayer = Rect & {
  id: string;
  type: "image";
  role: "background" | "photo";
  fit: "cover" | "contain";
  radius?: number;
  /** storage key of the image, or null when not yet available */
  src: string | null;
};
export type DocOverlayLayer = Rect & {
  id: string;
  type: "overlay";
  fill: string;
  opacity: number;
  gradient: "top" | "bottom" | "none";
};
export type DocTextLayer = Rect & {
  id: string;
  type: "text";
  role: TextRole;
  text: string;
  fontRole: "heading" | "body";
  /** CSS family name; brand font family or the fallback */
  fontFamily: string;
  weight: number;
  fontSize: number;
  maxSize: number;
  minSize: number;
  /** when true, the renderer re-fits the size between min and max with the real font */
  autoFit: boolean;
  align: "left" | "center" | "right";
  color: string;
  uppercase: boolean;
  lineHeight: number;
  background?: { fill: string; paddingX: number; paddingY: number; radius: number };
};
export type DocLogoLayer = Rect & {
  id: string;
  type: "logo";
  variant: "auto" | "default" | "light";
  src: string | null;
};
export type DocShapeLayer = Rect & {
  id: string;
  type: "shape";
  shape: "rect" | "circle" | "line";
  fill: string;
  radius?: number;
};
export type DocLayer = DocImageLayer | DocOverlayLayer | DocTextLayer | DocLogoLayer | DocShapeLayer;

export type VariantDocument = {
  templateId: string;
  formatKey: FormatKey;
  width: number;
  height: number;
  background: string;
  layers: DocLayer[];
};
