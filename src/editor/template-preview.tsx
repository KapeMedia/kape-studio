"use client";

import { useMemo } from "react";
import { DocumentCanvas } from "./document-canvas";
import { resolveDocument } from "@/lib/resolve";
import type { FormatSpec } from "@/lib/derive";
import type { TemplateDefinition, VariantDocument } from "@/lib/template-types";
import type { VariantCopy } from "@/lib/types";
import type { Palette } from "@/lib/colors";

export type BrandView = {
  palette: Palette;
  fonts: { heading: string; body: string };
  fontSources: { family: string; url: string }[];
  logo: string | null;
  logoLight: string | null;
};

export const DEMO_COPY: VariantCopy = {
  headline: "Reducere 40% la epilare definitivă",
  subheadline: "Doar până pe 30 noiembrie, în salonul nostru",
  cta: "Programează-te",
  extra: { price: "-40%", badge: "30 noiembrie" },
};

export const toFileUrl = (key: string) => `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;

export function TemplatePreview({
  definition,
  format,
  brand,
  width,
  copy = DEMO_COPY,
  backgroundKey = null,
  showSafeZone,
}: {
  definition: TemplateDefinition;
  format: FormatSpec;
  brand: BrandView;
  width: number;
  copy?: VariantCopy;
  backgroundKey?: string | null;
  showSafeZone?: boolean;
}) {
  const doc: VariantDocument | null = useMemo(() => {
    try {
      return resolveDocument({
        templateId: "preview",
        definition,
        format,
        copy,
        palette: brand.palette,
        fonts: brand.fonts,
        assets: { background: backgroundKey, logo: brand.logo, logoLight: brand.logoLight },
      });
    } catch {
      return null;
    }
  }, [definition, format, copy, brand, backgroundKey]);
  if (!doc) return <div className="text-xs text-red-600">Template invalid</div>;
  return (
    <DocumentCanvas
      doc={doc}
      displayWidth={width}
      fonts={brand.fontSources}
      fileUrl={toFileUrl}
      placeholder={[brand.palette.secondary, brand.palette.primary]}
      safeZone={format.safeZone}
      showSafeZone={showSafeZone}
    />
  );
}
