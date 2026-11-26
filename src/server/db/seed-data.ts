import type { BrandColor, SafeZone } from "@/lib/types";
import type { Layer, TemplateDefinition } from "@/lib/template-types";

export const USER_IDS = {
  onisim: "00000000-0000-4000-8000-000000000001",
  andrei: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
} as const;

export const SEED_USERS = [
  { id: USER_IDS.onisim, name: "Onisim", role: "owner" as const },
  { id: USER_IDS.andrei, name: "Andrei", role: "owner" as const },
  { id: USER_IDS.editor, name: "Editor", role: "editor" as const },
];

export const SEED_FORMATS: {
  key: string;
  label: string;
  width: number;
  height: number;
  safeZone: SafeZone;
  notes: string;
  sortOrder: number;
}[] = [
  {
    key: "feed_4x5",
    label: "Feed 4:5 (master)",
    width: 1080,
    height: 1350,
    safeZone: { top: 64, right: 64, bottom: 64, left: 64 },
    notes: "Padding vizual 64 px. Meta recomandă 4:5 pentru imagini single în Feed.",
    sortOrder: 1,
  },
  {
    key: "feed_1x1",
    label: "Feed 1:1 / carusel",
    width: 1080,
    height: 1080,
    safeZone: { top: 64, right: 64, bottom: 64, left: 64 },
    notes: "Padding 64 px. Cardurile de carusel sunt tăiate la 1:1.",
    sortOrder: 2,
  },
  {
    key: "story_9x16",
    label: "Story 9:16",
    width: 1080,
    height: 1920,
    safeZone: { top: 250, right: 64, bottom: 340, left: 64 },
    notes:
      "Safe zone unificată Stories/Reels: sus 250 px liber (~14%), jos 340 px liber (~18%), lateral 64 px.",
    sortOrder: 3,
  },
  {
    key: "landscape_191",
    label: "Landscape 1.91:1",
    width: 1200,
    height: 628,
    safeZone: { top: 48, right: 48, bottom: 48, left: 48 },
    notes: "Padding 48 px.",
    sortOrder: 4,
  },
  {
    key: "fb_cover",
    label: "Cover Facebook",
    width: 1640,
    height: 624,
    safeZone: {
      top: 48,
      right: 180,
      bottom: 48,
      left: 180,
      avoidRects: [{ x: 0, y: 404, w: 420, h: 220 }],
    },
    notes:
      "Afișat ~820 × 312. Text și logo doar în zona centrală (~78% din lățime). Colțul stânga-jos e acoperit de poza de profil. Specificațiile Meta se schimbă: verifică periodic.",
    sortOrder: 5,
  },
];

// ---------------------------------------------------------------------------
// Templates. Coordinates are relative (0–1). feed_4x5 + story_9x16 explicit.
// Story safe zone: top 0.13, bottom 0.823, sides 0.06.
// ---------------------------------------------------------------------------

const W = { hex: "#FFFFFF" } as const;

function ofertaClara(): TemplateDefinition {
  const feed: Layer[] = [
    { id: "photo", type: "image", role: "photo", box: { x: 0, y: 0, w: 1, h: 0.6 }, fit: "cover" },
    { id: "band", type: "shape", shape: "rect", box: { x: 0, y: 0.6, w: 1, h: 0.4 }, fill: { brand: "primary" } },
    { id: "logo", type: "logo", box: { x: 0.065, y: 0.05, w: 0.22, h: 0.08 }, variant: "auto" },
    {
      id: "price", type: "text", role: "price", box: { x: 0.6, y: 0.05, w: 0.335, h: 0.1 }, font: "heading",
      weight: 800, maxSize: 64, minSize: 32, align: "center", color: { brand: "text" },
      background: { fill: { brand: "accent" }, paddingX: 24, paddingY: 14, radius: 999 },
    },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.065, y: 0.63, w: 0.87, h: 0.16 }, font: "heading",
      weight: 800, maxSize: 92, minSize: 48, align: "left", color: { brand: "background" }, lineHeight: 1.05,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.065, y: 0.8, w: 0.87, h: 0.065 }, font: "body",
      weight: 500, maxSize: 40, minSize: 28, align: "left", color: { brand: "background" },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.065, y: 0.885, w: 0.45, h: 0.06 }, font: "heading",
      weight: 700, maxSize: 36, minSize: 28, align: "center", color: { brand: "text" }, uppercase: true,
      background: { fill: { brand: "accent" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  const story: Layer[] = [
    { id: "photo", type: "image", role: "photo", box: { x: 0, y: 0, w: 1, h: 0.58 }, fit: "cover" },
    { id: "band", type: "shape", shape: "rect", box: { x: 0, y: 0.58, w: 1, h: 0.42 }, fill: { brand: "primary" } },
    { id: "logo", type: "logo", box: { x: 0.065, y: 0.135, w: 0.24, h: 0.06 }, variant: "auto" },
    {
      id: "price", type: "text", role: "price", box: { x: 0.6, y: 0.135, w: 0.335, h: 0.07 }, font: "heading",
      weight: 800, maxSize: 72, minSize: 40, align: "center", color: { brand: "text" },
      background: { fill: { brand: "accent" }, paddingX: 24, paddingY: 14, radius: 999 },
    },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.065, y: 0.6, w: 0.87, h: 0.11 }, font: "heading",
      weight: 800, maxSize: 110, minSize: 60, align: "left", color: { brand: "background" }, lineHeight: 1.05,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.065, y: 0.715, w: 0.87, h: 0.045 }, font: "body",
      weight: 500, maxSize: 48, minSize: 40, align: "left", color: { brand: "background" },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.065, y: 0.77, w: 0.5, h: 0.045 }, font: "heading",
      weight: 700, maxSize: 44, minSize: 40, align: "center", color: { brand: "text" }, uppercase: true,
      background: { fill: { brand: "accent" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  return { layouts: { feed_4x5: { layers: feed }, story_9x16: { layers: story } } };
}

function fotoFull(): TemplateDefinition {
  const feed: Layer[] = [
    { id: "bg", type: "image", role: "background", box: { x: 0, y: 0, w: 1, h: 1 }, fit: "cover" },
    { id: "shade", type: "overlay", box: { x: 0, y: 0.4, w: 1, h: 0.6 }, fill: { hex: "#000000" }, opacity: 0.8, gradient: "bottom" },
    { id: "logo", type: "logo", box: { x: 0.065, y: 0.05, w: 0.22, h: 0.08 }, variant: "light" },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.065, y: 0.6, w: 0.87, h: 0.18 }, font: "heading",
      weight: 800, maxSize: 96, minSize: 48, align: "left", color: W, lineHeight: 1.05,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.065, y: 0.79, w: 0.87, h: 0.065 }, font: "body",
      weight: 500, maxSize: 40, minSize: 28, align: "left", color: W,
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.065, y: 0.88, w: 0.45, h: 0.06 }, font: "heading",
      weight: 700, maxSize: 36, minSize: 28, align: "center", color: W, uppercase: true,
      background: { fill: { brand: "primary" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  const story: Layer[] = [
    { id: "bg", type: "image", role: "background", box: { x: 0, y: 0, w: 1, h: 1 }, fit: "cover" },
    { id: "shade", type: "overlay", box: { x: 0, y: 0.38, w: 1, h: 0.62 }, fill: { hex: "#000000" }, opacity: 0.8, gradient: "bottom" },
    { id: "logo", type: "logo", box: { x: 0.065, y: 0.135, w: 0.24, h: 0.06 }, variant: "light" },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.065, y: 0.55, w: 0.87, h: 0.13 }, font: "heading",
      weight: 800, maxSize: 112, minSize: 60, align: "left", color: W, lineHeight: 1.05,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.065, y: 0.69, w: 0.87, h: 0.05 }, font: "body",
      weight: 500, maxSize: 48, minSize: 40, align: "left", color: W,
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.065, y: 0.76, w: 0.5, h: 0.05 }, font: "heading",
      weight: 700, maxSize: 44, minSize: 40, align: "center", color: W, uppercase: true,
      background: { fill: { brand: "primary" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  return { layouts: { feed_4x5: { layers: feed }, story_9x16: { layers: story } } };
}

function minimalPremium(): TemplateDefinition {
  const feed: Layer[] = [
    { id: "photo", type: "image", role: "photo", box: { x: 0.15, y: 0.16, w: 0.7, h: 0.46 }, fit: "cover", radius: 24 },
    { id: "logo", type: "logo", box: { x: 0.39, y: 0.05, w: 0.22, h: 0.07 }, variant: "default" },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.1, y: 0.66, w: 0.8, h: 0.13 }, font: "heading",
      weight: 500, maxSize: 72, minSize: 40, align: "center", color: { brand: "text" }, lineHeight: 1.1,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.15, y: 0.8, w: 0.7, h: 0.055 }, font: "body",
      weight: 400, maxSize: 34, minSize: 28, align: "center", color: { brand: "text" },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.3, y: 0.88, w: 0.4, h: 0.055 }, font: "body",
      weight: 600, maxSize: 30, minSize: 28, align: "center", color: { brand: "background" }, uppercase: true,
      background: { fill: { brand: "primary" }, paddingX: 28, paddingY: 14, radius: 999 },
    },
  ];
  const story: Layer[] = [
    { id: "photo", type: "image", role: "photo", box: { x: 0.12, y: 0.21, w: 0.76, h: 0.36 }, fit: "cover", radius: 24 },
    { id: "logo", type: "logo", box: { x: 0.38, y: 0.135, w: 0.24, h: 0.05 }, variant: "default" },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.1, y: 0.6, w: 0.8, h: 0.1 }, font: "heading",
      weight: 500, maxSize: 88, minSize: 48, align: "center", color: { brand: "text" }, lineHeight: 1.1,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.12, y: 0.705, w: 0.76, h: 0.04 }, font: "body",
      weight: 400, maxSize: 44, minSize: 40, align: "center", color: { brand: "text" },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.28, y: 0.765, w: 0.44, h: 0.045 }, font: "body",
      weight: 600, maxSize: 40, minSize: 40, align: "center", color: { brand: "background" }, uppercase: true,
      background: { fill: { brand: "primary" }, paddingX: 28, paddingY: 14, radius: 999 },
    },
  ];
  return {
    layouts: {
      feed_4x5: { background: { brand: "background" }, layers: feed },
      story_9x16: { background: { brand: "background" }, layers: story },
    },
  };
}

function testimonial(): TemplateDefinition {
  const feed: Layer[] = [
    { id: "bg", type: "image", role: "background", box: { x: 0, y: 0, w: 1, h: 1 }, fit: "cover" },
    { id: "veil", type: "overlay", box: { x: 0, y: 0, w: 1, h: 1 }, fill: { brand: "background" }, opacity: 0.9, gradient: "none" },
    { id: "logo", type: "logo", box: { x: 0.39, y: 0.05, w: 0.22, h: 0.07 }, variant: "default" },
    { id: "avatar", type: "image", role: "photo", box: { x: 0.4, y: 0.15, w: 0.2, h: 0.16 }, fit: "cover", radius: 999 },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.1, y: 0.35, w: 0.8, h: 0.33 }, font: "heading",
      weight: 600, maxSize: 64, minSize: 36, align: "center", color: { brand: "text" }, lineHeight: 1.2,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.1, y: 0.7, w: 0.8, h: 0.05 }, font: "body",
      weight: 600, maxSize: 34, minSize: 28, align: "center", color: { brand: "primary" },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.3, y: 0.86, w: 0.4, h: 0.06 }, font: "heading",
      weight: 700, maxSize: 32, minSize: 28, align: "center", color: { brand: "background" }, uppercase: true,
      background: { fill: { brand: "primary" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  const story: Layer[] = [
    { id: "bg", type: "image", role: "background", box: { x: 0, y: 0, w: 1, h: 1 }, fit: "cover" },
    { id: "veil", type: "overlay", box: { x: 0, y: 0, w: 1, h: 1 }, fill: { brand: "background" }, opacity: 0.9, gradient: "none" },
    { id: "logo", type: "logo", box: { x: 0.38, y: 0.135, w: 0.24, h: 0.05 }, variant: "default" },
    { id: "avatar", type: "image", role: "photo", box: { x: 0.38, y: 0.21, w: 0.24, h: 0.135 }, fit: "cover", radius: 999 },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.1, y: 0.37, w: 0.8, h: 0.27 }, font: "heading",
      weight: 600, maxSize: 76, minSize: 44, align: "center", color: { brand: "text" }, lineHeight: 1.2,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.1, y: 0.66, w: 0.8, h: 0.04 }, font: "body",
      weight: 600, maxSize: 44, minSize: 40, align: "center", color: { brand: "primary" },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.28, y: 0.76, w: 0.44, h: 0.05 }, font: "heading",
      weight: 700, maxSize: 42, minSize: 40, align: "center", color: { brand: "background" }, uppercase: true,
      background: { fill: { brand: "primary" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  return { layouts: { feed_4x5: { layers: feed }, story_9x16: { layers: story } } };
}

function anunt(): TemplateDefinition {
  const feed: Layer[] = [
    { id: "bg", type: "image", role: "background", box: { x: 0, y: 0, w: 1, h: 1 }, fit: "cover" },
    { id: "tint", type: "overlay", box: { x: 0, y: 0, w: 1, h: 1 }, fill: { brand: "primary" }, opacity: 0.85, gradient: "none" },
    { id: "circle", type: "shape", shape: "circle", box: { x: 0.62, y: -0.08, w: 0.6, h: 0.48 }, fill: { brand: "secondary" } },
    { id: "logo", type: "logo", box: { x: 0.065, y: 0.05, w: 0.2, h: 0.065 }, variant: "light" },
    {
      id: "badge", type: "text", role: "badge", box: { x: 0.065, y: 0.17, w: 0.5, h: 0.065 }, font: "heading",
      weight: 700, maxSize: 40, minSize: 28, align: "center", color: { brand: "text" }, uppercase: true,
      background: { fill: { brand: "accent" }, paddingX: 24, paddingY: 12, radius: 8 },
    },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.065, y: 0.27, w: 0.87, h: 0.36 }, font: "heading",
      weight: 900, maxSize: 132, minSize: 60, align: "left", color: { brand: "background" }, uppercase: true, lineHeight: 1,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.065, y: 0.66, w: 0.87, h: 0.09 }, font: "body",
      weight: 500, maxSize: 42, minSize: 28, align: "left", color: { brand: "background" },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.065, y: 0.83, w: 0.48, h: 0.065 }, font: "heading",
      weight: 700, maxSize: 36, minSize: 28, align: "center", color: { brand: "text" }, uppercase: true,
      background: { fill: { brand: "accent" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  const story: Layer[] = [
    { id: "bg", type: "image", role: "background", box: { x: 0, y: 0, w: 1, h: 1 }, fit: "cover" },
    { id: "tint", type: "overlay", box: { x: 0, y: 0, w: 1, h: 1 }, fill: { brand: "primary" }, opacity: 0.85, gradient: "none" },
    { id: "circle", type: "shape", shape: "circle", box: { x: 0.55, y: -0.05, w: 0.75, h: 0.42 }, fill: { brand: "secondary" } },
    { id: "logo", type: "logo", box: { x: 0.065, y: 0.135, w: 0.22, h: 0.05 }, variant: "light" },
    {
      id: "badge", type: "text", role: "badge", box: { x: 0.065, y: 0.22, w: 0.55, h: 0.045 }, font: "heading",
      weight: 700, maxSize: 46, minSize: 40, align: "center", color: { brand: "text" }, uppercase: true,
      background: { fill: { brand: "accent" }, paddingX: 24, paddingY: 12, radius: 8 },
    },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.065, y: 0.3, w: 0.87, h: 0.3 }, font: "heading",
      weight: 900, maxSize: 150, minSize: 70, align: "left", color: { brand: "background" }, uppercase: true, lineHeight: 1,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.065, y: 0.62, w: 0.87, h: 0.07 }, font: "body",
      weight: 500, maxSize: 50, minSize: 40, align: "left", color: { brand: "background" },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.065, y: 0.75, w: 0.52, h: 0.05 }, font: "heading",
      weight: 700, maxSize: 44, minSize: 40, align: "center", color: { brand: "text" }, uppercase: true,
      background: { fill: { brand: "accent" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  return { layouts: { feed_4x5: { layers: feed }, story_9x16: { layers: story } } };
}

function produsColor(): TemplateDefinition {
  const feed: Layer[] = [
    { id: "bg", type: "image", role: "background", box: { x: 0, y: 0, w: 1, h: 1 }, fit: "cover" },
    { id: "logo", type: "logo", box: { x: 0.4, y: 0.05, w: 0.2, h: 0.06 }, variant: "light" },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.065, y: 0.13, w: 0.87, h: 0.13 }, font: "heading",
      weight: 900, maxSize: 96, minSize: 48, align: "center", color: { brand: "background" }, uppercase: true, lineHeight: 1,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.1, y: 0.27, w: 0.8, h: 0.05 }, font: "body",
      weight: 500, maxSize: 36, minSize: 28, align: "center", color: { brand: "background" },
    },
    {
      id: "price", type: "text", role: "price", box: { x: 0.66, y: 0.66, w: 0.28, h: 0.09 }, font: "heading",
      weight: 900, maxSize: 64, minSize: 36, align: "center", color: { brand: "text" },
      background: { fill: { brand: "accent" }, paddingX: 22, paddingY: 14, radius: 999 },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.28, y: 0.875, w: 0.44, h: 0.065 }, font: "heading",
      weight: 800, maxSize: 38, minSize: 28, align: "center", color: { brand: "text" }, uppercase: true,
      background: { fill: { brand: "accent" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  const story: Layer[] = [
    { id: "bg", type: "image", role: "background", box: { x: 0, y: 0, w: 1, h: 1 }, fit: "cover" },
    { id: "logo", type: "logo", box: { x: 0.39, y: 0.135, w: 0.22, h: 0.05 }, variant: "light" },
    {
      id: "headline", type: "text", role: "headline", box: { x: 0.065, y: 0.2, w: 0.87, h: 0.11 }, font: "heading",
      weight: 900, maxSize: 120, minSize: 60, align: "center", color: { brand: "background" }, uppercase: true, lineHeight: 1,
    },
    {
      id: "subheadline", type: "text", role: "subheadline", box: { x: 0.1, y: 0.315, w: 0.8, h: 0.04 }, font: "body",
      weight: 500, maxSize: 46, minSize: 40, align: "center", color: { brand: "background" },
    },
    {
      id: "price", type: "text", role: "price", box: { x: 0.62, y: 0.6, w: 0.32, h: 0.07 }, font: "heading",
      weight: 900, maxSize: 72, minSize: 40, align: "center", color: { brand: "text" },
      background: { fill: { brand: "accent" }, paddingX: 22, paddingY: 14, radius: 999 },
    },
    {
      id: "cta", type: "text", role: "cta", box: { x: 0.25, y: 0.765, w: 0.5, h: 0.05 }, font: "heading",
      weight: 800, maxSize: 44, minSize: 40, align: "center", color: { brand: "text" }, uppercase: true,
      background: { fill: { brand: "accent" }, paddingX: 28, paddingY: 16, radius: 12 },
    },
  ];
  return { layouts: { feed_4x5: { layers: feed }, story_9x16: { layers: story } } };
}

export const SEED_STYLES: {
  slug: string;
  name: string;
  description: string;
  whenToUse: string;
  template: { name: string; description: string; definition: TemplateDefinition };
  visualPrompt: string;
  avoid: string;
  copyGuidance: string;
}[] = [
  {
    slug: "oferta-clara",
    name: "Ofertă clară",
    description: "Poză mare sus (60%), bandă de culoare primară jos cu headline mare, preț/discount ca badge, CTA ca buton.",
    whenToUse: "Reduceri, promoții, oferte cu preț sau procent.",
    template: { name: "Ofertă clară", description: "Poză sus 60%, bandă primară jos, badge preț, buton CTA.", definition: ofertaClara() },
    visualPrompt:
      "Bright, clean commercial photograph of the service or product in a real setting, natural light, sharp subject, shallow depth of field. The subject sits in the upper part of the frame; the lower 40% of the frame can be plain because it will be covered by a colour band.",
    avoid: "Busy backgrounds, stock-photo clichés, exaggerated smiles, any visible text or signage.",
    copyGuidance: "Headline ≤ 6 cuvinte, cu oferta concretă (procent sau preț). Badge = procentul sau prețul. CTA scurt, la imperativ.",
  },
  {
    slug: "foto-full-gradient",
    name: "Foto full + gradient",
    description: "Poză pe tot ecranul, gradient închis jos, headline alb + CTA.",
    whenToUse: "Universal. Când avem o imagine puternică.",
    template: { name: "Foto full + gradient", description: "Imagine full-bleed, gradient negru jos, text alb.", definition: fotoFull() },
    visualPrompt:
      "Full-bleed, high-impact editorial photograph, cinematic lighting, strong single subject in the upper two thirds, darker and calmer lower third for overlaid text.",
    avoid: "Bright clutter in the lower third, faces cut by the gradient, any text or watermark.",
    copyGuidance: "Headline ≤ 7 cuvinte, emoțional sau beneficiu clar. Subheadline o propoziție scurtă.",
  },
  {
    slug: "minimal-premium",
    name: "Minimal premium",
    description: "Fundal de culoare, un singur obiect sau o scenă mică în centru, mult spațiu liber, tipografie elegantă.",
    whenToUse: "Beauty, servicii premium, branding calm.",
    template: { name: "Minimal premium", description: "Fundal brand, imagine centrală cu colțuri rotunjite, text centrat.", definition: minimalPremium() },
    visualPrompt:
      "Minimal, premium still life: a single elegant object or small scene centred, soft diffused studio light, lots of negative space, muted tones harmonised with the brand palette.",
    avoid: "Multiple subjects, saturated neon colours, clutter, any text.",
    copyGuidance: "Headline ≤ 5 cuvinte, ton calm, elegant. Fără semne de exclamare.",
  },
  {
    slug: "testimonial",
    name: "Testimonial",
    description: "Citat mare între ghilimele, nume, poză mică rotundă sau fundal discret.",
    whenToUse: "Social proof, recenzii, rezultate povestite de clienți.",
    template: { name: "Testimonial", description: "Citat centrat, avatar rotund, nume în culoarea primară.", definition: testimonial() },
    visualPrompt:
      "Warm, authentic portrait-style photograph with a softly blurred background, natural light, friendly and real (not a model look). Works when heavily faded behind text.",
    avoid: "Before/after imagery, fake-looking people, any text.",
    copyGuidance:
      "Headline = citatul, între ghilimele românești „…”, maxim 20 de cuvinte, fără să inventezi recenzii: dacă brief-ul nu are un citat real, scrie un mesaj de tip social proof fără nume inventate. Subheadline = numele/sursa dacă există în brief.",
  },
  {
    slug: "anunt-eveniment",
    name: "Anunț / eveniment",
    description: "Dată + titlu foarte mare, fundal grafic simplu în culorile brandului.",
    whenToUse: "Evenimente, deschideri, program special, anunțuri.",
    template: { name: "Anunț / eveniment", description: "Fundal primar, cerc decorativ, badge dată, titlu uriaș.", definition: anunt() },
    visualPrompt:
      "Simple abstract graphic background: soft geometric shapes and subtle texture in the brand colours, flat and calm, no objects, no people. It will be tinted strongly with the brand colour.",
    avoid: "Detailed scenes, photos of people, any text, numbers or letters.",
    copyGuidance: "Badge = data sau momentul (ex: „30 NOIEMBRIE”). Headline ≤ 4 cuvinte, foarte puternic. Subheadline = detaliul practic.",
  },
  {
    slug: "produs-fundal-colorat",
    name: "Produs pe fundal colorat",
    description: "Produsul centrat pe culoare plină, headline sus, CTA jos.",
    whenToUse: "Food, produse fizice, meniuri.",
    template: { name: "Produs pe fundal colorat", description: "Produs centrat pe culoare plină, headline sus, preț badge.", definition: produsColor() },
    visualPrompt:
      "Appetising hero product shot centred on a solid flat background in the brand primary colour, studio lighting, crisp detail, slight shadow, top 30% and bottom 15% of the frame left empty.",
    avoid: "Props that clutter, multiple products, hands, any text or packaging labels.",
    copyGuidance: "Headline ≤ 4 cuvinte, poftă/impact. Preț în badge dacă există în brief. CTA scurt.",
  },
];

export const DEMO_CLIENTS: {
  name: string;
  slug: string;
  industry: "beauty" | "food";
  description: string;
  audience: string;
  tone: string;
  dos: string;
  donts: string;
  activeOffers: string;
  colors: BrandColor[];
  project: { name: string; description: string };
}[] = [
  {
    name: "Demo Beauty Salon",
    slug: "demo-beauty-salon",
    industry: "beauty",
    description: "Salon demo de înfrumusețare: tratamente faciale, epilare definitivă, remodelare corporală.",
    audience: "Femei 25–45 de ani din oraș, care vor rezultate vizibile și un loc de încredere.",
    tone: "Cald, profesionist, liniștitor. Fără promisiuni exagerate.",
    dos: "Imagini luminoase, curate. Accent pe profesionalism și igienă.",
    donts: "Fără before/after. Fără mesaje despre greutate sau defecte corporale.",
    activeOffers: "Pachet 6 ședințe epilare definitivă: -30% (demo).",
    colors: [
      { name: "Roz prăfuit", hex: "#A8456B", role: "primary" },
      { name: "Roz pal", hex: "#F3DCE4", role: "secondary" },
      { name: "Auriu", hex: "#E2B657", role: "accent" },
      { name: "Alb cald", hex: "#FFF9FA", role: "background" },
      { name: "Grafit", hex: "#2B2024", role: "text" },
    ],
    project: { name: "Campanie demo noiembrie", description: "Proiect demo pentru teste." },
  },
  {
    name: "Demo Smash Burgers",
    slug: "demo-smash-burgers",
    industry: "food",
    description: "Burgerie demo: smash burgers, cartofi, livrare.",
    audience: "Tineri 18–35 de ani, studenți și angajați, comenzi seara și în weekend.",
    tone: "Energic, direct, cu umor ușor.",
    dos: "Mâncare apetisantă, prim-planuri, culori calde.",
    donts: "Fără imagini cu mâncare arsă sau dezordonată.",
    activeOffers: "Meniu Double Smash + cartofi: 39 lei (demo).",
    colors: [
      { name: "Roșu ketchup", hex: "#C8102E", role: "primary" },
      { name: "Galben muștar", hex: "#F6B40E", role: "secondary" },
      { name: "Galben aprins", hex: "#FFD23F", role: "accent" },
      { name: "Crem", hex: "#FFF8EC", role: "background" },
      { name: "Negru cărbune", hex: "#1B1B1B", role: "text" },
    ],
    project: { name: "Lansare meniu demo", description: "Proiect demo pentru teste." },
  },
];

export const SEED_AGENCY_RULES = [
  "Scrie mereu cu diacritice corecte: ș și ț cu virgulă dedesubt.",
  "Nu inventa prețuri, procente sau date care nu apar în brief sau în brand kit.",
];
