import type { Box, FormatKey, Layer, Layout, TemplateDefinition } from "./template-types";
import type { SafeZone } from "./types";

export type FormatSpec = { key: string; width: number; height: number; safeZone: SafeZone };

const EPS = 0.002;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const round = (v: number) => Math.round(v * 10000) / 10000;
const roundBox = (b: Box): Box => ({ x: round(b.x), y: round(b.y), w: round(b.w), h: round(b.h) });

function scaleText<L extends Layer>(l: L, s: number): L {
  if (l.type !== "text") return l;
  const maxSize = Math.max(12, Math.round(l.maxSize * s));
  const minSize = Math.min(maxSize, Math.max(10, Math.round(l.minSize * s)));
  return { ...l, maxSize, minSize };
}

/** feed_1x1 from feed_4x5: same relative boxes (compressed vertically). */
function deriveSquare(master: Layout): Layout {
  return { ...master, layers: master.layers.map((l) => ({ ...l, box: { ...l.box } })) };
}

/**
 * story from 4:5: the 4:5 content is fitted & centred vertically in the safe zone;
 * layers touching the top/bottom edge are extended to the canvas edge (image fills the canvas).
 */
function deriveStory(master: Layout, target: FormatSpec, masterSpec: { width: number; height: number }): Layout {
  const W = target.width;
  const H = target.height;
  const sz = target.safeZone;
  const safeH = H - sz.top - sz.bottom;
  const contentW = W;
  const contentH = (masterSpec.height / masterSpec.width) * W;
  const s = Math.min(1, safeH / contentH);
  const drawnH = contentH * s;
  const offY = sz.top + (safeH - drawnH) / 2;
  const offX = (W - contentW * s) / 2;

  const layers = master.layers.map((l): Layer => {
    const touchesTop = l.box.y <= EPS;
    const touchesBottom = l.box.y + l.box.h >= 1 - EPS;
    const fullWidth = l.box.x <= EPS && l.box.x + l.box.w >= 1 - EPS;
    const isFullBleed = l.type === "image" || l.type === "overlay" || l.type === "shape";
    if (l.type === "image" && l.role === "background") return { ...l, box: { x: 0, y: 0, w: 1, h: 1 } };

    let y = (offY + l.box.y * contentH * s) / H;
    let bottom = (offY + (l.box.y + l.box.h) * contentH * s) / H;
    let x = (offX + l.box.x * contentW * s) / W;
    let right = (offX + (l.box.x + l.box.w) * contentW * s) / W;
    if (isFullBleed && fullWidth) {
      x = 0;
      right = 1;
      if (touchesTop) y = 0;
      if (touchesBottom) bottom = 1;
    }
    return scaleText({ ...l, box: roundBox({ x, y, w: right - x, h: bottom - y }) } as Layer, s);
  });
  return { ...master, layers };
}

const TEXT_ORDER = ["badge", "price", "headline", "subheadline", "body", "cta"] as const;

/**
 * landscape / cover: image on the whole canvas, text stacked in the left half
 * (or the centre for fb_cover), logo at the top. Decorative shapes are dropped.
 */
function deriveWide(master: Layout, target: FormatSpec, masterSpec: { width: number; height: number }): Layout {
  const W = target.width;
  const H = target.height;
  const sz = target.safeZone;
  const center = target.key === "fb_cover";
  const colX = sz.left / W;
  const colW = center ? (W - sz.left - sz.right) / W : Math.min(0.5, (W - sz.left - sz.right) / W) - 0.02;
  const top = sz.top / H;
  const bottom = 1 - sz.bottom / H;
  const s = clamp(Math.min(W / masterSpec.width, H / masterSpec.height) * 1.3, 0.4, 1);

  const out: Layer[] = [];
  const hasBackgroundImage = master.layers.some((l) => l.type === "image");
  for (const l of master.layers) {
    if (l.type === "image") {
      if (out.some((o) => o.type === "image")) continue;
      out.push({ ...l, role: "background", radius: undefined, box: { x: 0, y: 0, w: 1, h: 1 } });
    } else if (l.type === "overlay") {
      out.push({
        ...l,
        gradient: "none",
        box: center ? { x: 0, y: 0, w: 1, h: 1 } : { x: 0, y: 0, w: 0.58, h: 1 },
        opacity: Math.min(l.opacity, 0.85),
      });
    }
  }
  // Text needs a calm area when the master put it on a colour band/shape: add a scrim.
  if (hasBackgroundImage && !out.some((o) => o.type === "overlay")) {
    const band = master.layers.find((l) => l.type === "shape" && l.shape === "rect");
    out.push({
      id: "scrim",
      type: "overlay",
      box: center ? { x: 0, y: 0, w: 1, h: 1 } : { x: 0, y: 0, w: 0.58, h: 1 },
      fill: band && band.type === "shape" ? band.fill : { brand: "primary" },
      opacity: center ? 0.55 : 0.88,
      gradient: "none",
    });
  }

  const logo = master.layers.find((l) => l.type === "logo");
  const logoH = 0.12;
  if (logo) {
    const lw = Math.min(0.2, colW * 0.4);
    out.push({ ...logo, box: roundBox({ x: center ? 0.5 - lw / 2 : colX, y: top, w: lw, h: logoH }) });
  }

  const texts = master.layers
    .filter((l): l is Extract<Layer, { type: "text" }> => l.type === "text")
    .sort((a, b) => TEXT_ORDER.indexOf(a.role) - TEXT_ORDER.indexOf(b.role));
  const startY = top + (logo ? logoH + 0.03 : 0);
  const avail = bottom - startY;
  const totalH = texts.reduce((acc, t) => acc + t.box.h, 0) || 1;
  const gap = 0.02;
  const scaleH = (avail - gap * Math.max(0, texts.length - 1)) / totalH;
  let y = startY;
  for (const t of texts) {
    const h = t.box.h * scaleH;
    const isButton = !!t.background;
    const w = isButton ? Math.min(colW, Math.max(0.2, (t.box.w / 1) * colW)) : colW;
    const x = center ? 0.5 - w / 2 : colX;
    out.push(scaleText({ ...t, align: center ? "center" : isButton ? "center" : "left", box: roundBox({ x, y, w, h }) }, s));
    y += h + gap;
  }
  return { background: master.background, layers: out };
}

/** Returns the template layout for a format: explicit if defined, otherwise derived from feed_4x5. */
export function getLayout(
  def: TemplateDefinition,
  target: FormatSpec,
  masterSpec: { width: number; height: number } = { width: 1080, height: 1350 },
): Layout {
  const explicit = def.layouts[target.key as FormatKey];
  if (explicit) return explicit;
  const master = def.layouts.feed_4x5!;
  if (target.key === "feed_4x5") return master;
  if (target.key === "feed_1x1") return deriveSquare(master);
  const ratio = target.width / target.height;
  if (ratio < 0.8) return deriveStory(master, target, masterSpec);
  if (ratio > 1.3) return deriveWide(master, target, masterSpec);
  return deriveSquare(master);
}
