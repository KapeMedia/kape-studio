import type { Palette } from "./colors";
import type { ColorRef, DocLayer, FormatKey, Layer, TemplateDefinition, VariantDocument } from "./template-types";
import type { VariantCopy } from "./types";
import { getLayout, type FormatSpec } from "./derive";
import { approxMeasure, fitText, type Measurer } from "./text-fit";
import { normalizeDiacritics } from "./diacritics";

export type ResolveFonts = { heading: string; body: string };
export type ResolveAssets = { background: string | null; logo: string | null; logoLight: string | null };

export type ResolveInput = {
  templateId: string;
  definition: TemplateDefinition;
  format: FormatSpec;
  copy: VariantCopy;
  palette: Palette;
  fonts: ResolveFonts;
  assets: ResolveAssets;
  measure?: (fontFamily: string, weight: number) => Measurer;
};

export function resolveColor(ref: ColorRef, palette: Palette): string {
  return "brand" in ref ? palette[ref.brand] : ref.hex.toUpperCase();
}

export function textForRole(role: string, copy: VariantCopy): string {
  switch (role) {
    case "headline":
      return copy.headline ?? "";
    case "subheadline":
      return copy.subheadline ?? "";
    case "cta":
      return copy.cta ?? "";
    case "price":
      return copy.extra?.price ?? "";
    case "badge":
      return copy.extra?.badge ?? "";
    default:
      return "";
  }
}

export function displayText(text: string, uppercase: boolean): string {
  return uppercase ? text.toLocaleUpperCase("ro-RO") : text;
}

/** Re-fits a text layer (used on server with approx measure and in the browser with the real font). */
export function fitTextLayer(layer: Extract<DocLayer, { type: "text" }>, measure: Measurer) {
  const padX = layer.background ? layer.background.paddingX * 2 : 0;
  const padY = layer.background ? layer.background.paddingY * 2 : 0;
  return fitText({
    text: displayText(layer.text, layer.uppercase),
    width: Math.max(10, layer.w - padX),
    height: Math.max(10, layer.h - padY),
    maxSize: layer.maxSize,
    minSize: layer.minSize,
    lineHeight: layer.lineHeight,
    measure,
  });
}

/** Pure: template layout + format + copy + brand → concrete editable document. */
export function resolveDocument(input: ResolveInput): VariantDocument {
  const { format, palette, fonts, assets, copy } = input;
  const layout = getLayout(input.definition, format);
  const W = format.width;
  const H = format.height;
  const abs = (l: Layer) => ({ x: l.box.x * W, y: l.box.y * H, w: l.box.w * W, h: l.box.h * H });

  const layers: DocLayer[] = [];
  for (const l of layout.layers) {
    switch (l.type) {
      case "image":
        layers.push({ id: l.id, type: "image", role: l.role, fit: l.fit, radius: l.radius, src: assets.background, ...abs(l) });
        break;
      case "overlay":
        layers.push({ id: l.id, type: "overlay", fill: resolveColor(l.fill, palette), opacity: l.opacity, gradient: l.gradient ?? "none", ...abs(l) });
        break;
      case "shape":
        layers.push({ id: l.id, type: "shape", shape: l.shape, fill: resolveColor(l.fill, palette), radius: l.radius, ...abs(l) });
        break;
      case "logo": {
        const src =
          l.variant === "light" ? (assets.logoLight ?? assets.logo) : l.variant === "default" ? (assets.logo ?? assets.logoLight) : (assets.logo ?? assets.logoLight);
        if (src) layers.push({ id: l.id, type: "logo", variant: l.variant, src, ...abs(l) });
        break;
      }
      case "text": {
        const text = normalizeDiacritics(textForRole(l.role, copy)).trim();
        if (!text) break;
        const fontFamily = l.font === "heading" ? fonts.heading : fonts.body;
        const weight = l.weight ?? (l.font === "heading" ? 700 : 400);
        const doc: Extract<DocLayer, { type: "text" }> = {
          id: l.id,
          type: "text",
          role: l.role,
          text,
          fontRole: l.font,
          fontFamily,
          weight,
          fontSize: l.maxSize,
          maxSize: l.maxSize,
          minSize: l.minSize,
          autoFit: true,
          align: l.align,
          color: resolveColor(l.color, palette),
          uppercase: !!l.uppercase,
          lineHeight: l.lineHeight ?? 1.15,
          background: l.background
            ? { fill: resolveColor(l.background.fill, palette), paddingX: l.background.paddingX, paddingY: l.background.paddingY, radius: l.background.radius }
            : undefined,
          ...abs(l),
        };
        const measure = input.measure ? input.measure(fontFamily, weight) : approxMeasure;
        doc.fontSize = fitTextLayer(doc, measure).fontSize;
        layers.push(doc);
        break;
      }
    }
  }
  return {
    templateId: input.templateId,
    formatKey: format.key as FormatKey,
    width: W,
    height: H,
    background: layout.background ? resolveColor(layout.background, palette) : palette.background,
    layers,
  };
}

/** Copies user edits (text, colours) from an existing doc onto a freshly derived doc for another format. */
export function carryOverEdits(from: VariantDocument, to: VariantDocument): VariantDocument {
  const byId = new Map(from.layers.map((l) => [l.id, l]));
  return {
    ...to,
    layers: to.layers.map((l) => {
      const src = byId.get(l.id);
      if (!src || src.type !== l.type) return l;
      if (l.type === "text" && src.type === "text") return { ...l, text: src.text, color: src.color, fontFamily: src.fontFamily, background: l.background && src.background ? { ...l.background, fill: src.background.fill } : l.background };
      if (l.type === "image" && src.type === "image") return { ...l, src: src.src };
      if ((l.type === "shape" && src.type === "shape") || (l.type === "overlay" && src.type === "overlay")) return { ...l, fill: src.fill };
      return l;
    }),
  };
}
