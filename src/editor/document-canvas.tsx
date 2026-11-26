"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Ellipse, Group, Image as KImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { DocLayer, DocTextLayer, VariantDocument } from "@/lib/template-types";
import { displayText, fitTextLayer } from "@/lib/resolve";
import type { Measurer } from "@/lib/text-fit";
import { hexToRgb } from "@/lib/colors";
import type { SafeZone } from "@/lib/types";
import { FALLBACK_FONT, loadFonts, type FontSource } from "./fonts";

// ---------------- helpers ----------------

const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Nu am putut încărca imaginea ${url}`));
      img.src = url;
    });
    imageCache.set(url, p);
    p.catch(() => imageCache.delete(url));
  }
  return p;
}

let measureCtx: CanvasRenderingContext2D | null = null;
export function fontString(family: string, weight: number, size: number) {
  return `${weight} ${size}px "${family}", ${FALLBACK_FONT}`;
}
export function browserMeasurer(family: string, weight: number): Measurer {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return (text, size) => {
    if (!measureCtx) return text.length * size * 0.55;
    measureCtx.font = fontString(family, weight, size);
    return measureCtx.measureText(text).width;
  };
}

function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function coverCrop(img: HTMLImageElement, w: number, h: number) {
  const ir = img.naturalWidth / img.naturalHeight;
  const br = w / h;
  if (ir > br) {
    const cw = img.naturalHeight * br;
    return { x: (img.naturalWidth - cw) / 2, y: 0, width: cw, height: img.naturalHeight };
  }
  const ch = img.naturalWidth / br;
  return { x: 0, y: (img.naturalHeight - ch) / 2, width: img.naturalWidth, height: ch };
}

function containRect(img: HTMLImageElement, x: number, y: number, w: number, h: number, align: "left" | "center" | "right") {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const dx = align === "left" ? x : align === "right" ? x + w - dw : x + (w - dw) / 2;
  return { x: dx, y: y + (h - dh) / 2, width: dw, height: dh };
}

export type TextMetrics = Record<string, { fontSize: number; overflow: boolean }>;

export type DocumentCanvasHandle = {
  /** PNG data URL at full document resolution. */
  toDataURL: (mime?: string) => string | null;
  /** Resolves once fonts and images are loaded and drawn. */
  whenReady: () => Promise<void>;
  getTextMetrics: () => TextMetrics;
};

type Props = {
  doc: VariantDocument;
  /** display width in CSS px; the document is scaled to fit */
  displayWidth: number;
  fonts: FontSource[];
  fileUrl: (key: string) => string;
  placeholder?: [string, string];
  safeZone?: SafeZone | null;
  showSafeZone?: boolean;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onLayerChange?: (id: string, patch: Partial<DocLayer>) => void;
  onTextDblClick?: (id: string) => void;
  onMetrics?: (m: TextMetrics) => void;
};

// ---------------- component ----------------

export const DocumentCanvas = forwardRef<DocumentCanvasHandle, Props>(function DocumentCanvas(props, ref) {
  const { doc, displayWidth, fonts, fileUrl, placeholder = ["#D1D5DB", "#9CA3AF"], editable, selectedId, onSelect, onLayerChange } = props;
  const scale = displayWidth / doc.width;
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [images, setImages] = useState<Record<string, HTMLImageElement | null>>({});
  const readyResolvers = useRef<(() => void)[]>([]);

  const fontKey = fonts.map((f) => f.family + f.url).join("|");
  useEffect(() => {
    let alive = true;
    loadFonts(fonts).then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fontKey captures the font list
  }, [fontKey]);

  const srcs = useMemo(
    () => Array.from(new Set(doc.layers.flatMap((l) => ((l.type === "image" || l.type === "logo") && l.src ? [l.src] : [])))),
    [doc.layers],
  );
  useEffect(() => {
    let alive = true;
    for (const src of srcs) {
      if (src in images) continue;
      loadImage(fileUrl(src))
        .then((img) => alive && setImages((p) => ({ ...p, [src]: img })))
        .catch(() => alive && setImages((p) => ({ ...p, [src]: null })));
    }
    return () => {
      alive = false;
    };
  }, [srcs, images, fileUrl]);

  const ready = fontsReady && srcs.every((s) => s in images);

  // Text fitting with the real (loaded) font.
  const metrics = useMemo<TextMetrics>(() => {
    const m: TextMetrics = {};
    if (!fontsReady) return m;
    for (const l of doc.layers) {
      if (l.type !== "text") continue;
      const fit = fitTextLayer(l, browserMeasurer(l.fontFamily, l.weight));
      if (l.autoFit) m[l.id] = { fontSize: fit.fontSize, overflow: fit.overflow };
      else {
        const fixed = fitTextLayer({ ...l, maxSize: l.fontSize, minSize: l.fontSize }, browserMeasurer(l.fontFamily, l.weight));
        m[l.id] = { fontSize: l.fontSize, overflow: fixed.overflow };
      }
    }
    return m;
  }, [doc.layers, fontsReady]);

  const onMetrics = props.onMetrics;
  useEffect(() => {
    if (fontsReady) onMetrics?.(metrics);
  }, [metrics, fontsReady, onMetrics]);

  useEffect(() => {
    if (!ready) return;
    stageRef.current?.batchDraw();
    const t = setTimeout(() => {
      readyResolvers.current.splice(0).forEach((r) => r());
    }, 30);
    return () => clearTimeout(t);
  }, [ready, doc]);

  useImperativeHandle(
    ref,
    () => ({
      toDataURL: (mime = "image/png") => {
        const stage = stageRef.current;
        if (!stage) return null;
        const tr = trRef.current;
        const wasVisible = tr?.visible();
        tr?.visible(false);
        const guides = stage.find(".guide");
        guides.forEach((g) => g.visible(false));
        const url = stage.toDataURL({ mimeType: mime, pixelRatio: 1 / scale });
        guides.forEach((g) => g.visible(true));
        if (tr && wasVisible) tr.visible(true);
        return url;
      },
      whenReady: () => (ready ? new Promise((r) => setTimeout(r, 30)) : new Promise<void>((r) => readyResolvers.current.push(r))),
      getTextMetrics: () => metrics,
    }),
    [ready, scale, metrics],
  );

  // Transformer follows the selected node.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selectedId ? stage.findOne(`#layer-${selectedId}`) : null;
    tr.nodes(node && editable ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, editable, doc]);

  const commitTransform = useCallback(
    (l: DocLayer, node: Konva.Node) => {
      const sx = node.scaleX();
      const sy = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onLayerChange?.(l.id, { x: node.x(), y: node.y(), w: Math.max(10, l.w * sx), h: Math.max(10, l.h * sy) });
    },
    [onLayerChange],
  );

  const common = (l: DocLayer) => ({
    id: `layer-${l.id}`,
    x: l.x,
    y: l.y,
    draggable: !!editable,
    onMouseDown: editable
      ? (e: Konva.KonvaEventObject<MouseEvent>) => {
          e.cancelBubble = true;
          onSelect?.(l.id);
        }
      : undefined,
    onTap: editable ? () => onSelect?.(l.id) : undefined,
    onDragEnd: editable ? (e: Konva.KonvaEventObject<DragEvent>) => onLayerChange?.(l.id, { x: e.target.x(), y: e.target.y() }) : undefined,
    onTransformEnd: editable ? (e: Konva.KonvaEventObject<Event>) => commitTransform(l, e.target) : undefined,
  });

  const renderText = (l: DocTextLayer) => {
    const m = metrics[l.id];
    const fontSize = m?.fontSize ?? l.fontSize;
    const text = displayText(l.text, l.uppercase);
    const style = String(l.weight);
    const family = `${l.fontFamily}, ${FALLBACK_FONT}`;
    if (l.background) {
      const measure = browserMeasurer(l.fontFamily, l.weight);
      const fit = fitTextLayer({ ...l, autoFit: false, maxSize: fontSize, minSize: fontSize }, measure);
      const innerW = Math.min(l.w - l.background.paddingX * 2, Math.ceil(fit.maxLineWidth) + 2);
      const bgW = innerW + l.background.paddingX * 2;
      const bgH = Math.min(l.h, fit.textHeight + l.background.paddingY * 2);
      const bx = l.align === "left" ? 0 : l.align === "right" ? l.w - bgW : (l.w - bgW) / 2;
      const by = (l.h - bgH) / 2;
      const radius = Math.min(l.background.radius, bgH / 2);
      return (
        <Group key={l.id} {...common(l)} onDblClick={() => props.onTextDblClick?.(l.id)} onDblTap={() => props.onTextDblClick?.(l.id)}>
          <Rect width={l.w} height={l.h} fill="transparent" />
          <Rect x={bx} y={by} width={bgW} height={bgH} fill={l.background.fill} cornerRadius={radius} />
          <Text
            x={bx + l.background.paddingX}
            y={by}
            width={innerW}
            height={bgH}
            text={text}
            fontSize={fontSize}
            fontFamily={family}
            fontStyle={style}
            fill={l.color}
            align="center"
            verticalAlign="middle"
            lineHeight={l.lineHeight}
            wrap="word"
            ellipsis={!!m?.overflow}
          />
        </Group>
      );
    }
    return (
      <Group key={l.id} {...common(l)} onDblClick={() => props.onTextDblClick?.(l.id)} onDblTap={() => props.onTextDblClick?.(l.id)}>
        <Rect width={l.w} height={l.h} fill="transparent" />
        <Text
          width={l.w}
          height={l.h}
          text={text}
          fontSize={fontSize}
          fontFamily={family}
          fontStyle={style}
          fill={l.color}
          align={l.align}
          verticalAlign="middle"
          lineHeight={l.lineHeight}
          wrap="word"
          ellipsis={!!m?.overflow}
        />
      </Group>
    );
  };

  const renderLayer = (l: DocLayer) => {
    switch (l.type) {
      case "image": {
        const img = l.src ? images[l.src] : null;
        const radius = l.radius ? Math.min(l.radius, Math.min(l.w, l.h) / 2) : 0;
        if (!img) {
          return (
            <Group key={l.id} {...common(l)}>
              <Rect
                width={l.w}
                height={l.h}
                cornerRadius={radius}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: l.w, y: l.h }}
                fillLinearGradientColorStops={[0, placeholder[0], 1, placeholder[1]]}
              />
            </Group>
          );
        }
        if (l.fit === "contain") {
          const r = containRect(img, 0, 0, l.w, l.h, "center");
          return (
            <Group key={l.id} {...common(l)}>
              <Rect width={l.w} height={l.h} fill="transparent" />
              <KImage image={img} {...r} cornerRadius={radius} />
            </Group>
          );
        }
        return (
          <Group key={l.id} {...common(l)}>
            <KImage image={img} width={l.w} height={l.h} crop={coverCrop(img, l.w, l.h)} cornerRadius={radius} />
          </Group>
        );
      }
      case "overlay": {
        const stops =
          l.gradient === "bottom"
            ? [0, rgba(l.fill, 0), 1, rgba(l.fill, l.opacity)]
            : l.gradient === "top"
              ? [0, rgba(l.fill, l.opacity), 1, rgba(l.fill, 0)]
              : null;
        return (
          <Group key={l.id} {...common(l)}>
            {stops ? (
              <Rect width={l.w} height={l.h} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 0, y: l.h }} fillLinearGradientColorStops={stops} />
            ) : (
              <Rect width={l.w} height={l.h} fill={rgba(l.fill, l.opacity)} />
            )}
          </Group>
        );
      }
      case "shape":
        return (
          <Group key={l.id} {...common(l)}>
            {l.shape === "circle" ? (
              <Ellipse x={l.w / 2} y={l.h / 2} radiusX={l.w / 2} radiusY={l.h / 2} fill={l.fill} />
            ) : (
              <Rect width={l.w} height={l.shape === "line" ? Math.max(2, Math.min(l.h, 8)) : l.h} fill={l.fill} cornerRadius={l.radius ?? 0} />
            )}
          </Group>
        );
      case "logo": {
        const img = l.src ? images[l.src] : null;
        const cx = l.x + l.w / 2;
        const align = cx < doc.width * 0.35 ? "left" : cx > doc.width * 0.65 ? "right" : "center";
        return (
          <Group key={l.id} {...common(l)}>
            <Rect width={l.w} height={l.h} fill="transparent" />
            {img && <KImage image={img} {...containRect(img, 0, 0, l.w, l.h, align)} />}
          </Group>
        );
      }
      case "text":
        return renderText(l);
    }
  };

  const sz = props.safeZone;
  return (
    <Stage
      ref={stageRef}
      width={doc.width * scale}
      height={doc.height * scale}
      onMouseDown={(e) => {
        if (editable && e.target === e.target.getStage()) onSelect?.(null);
      }}
    >
      <Layer scaleX={scale} scaleY={scale}>
        <Rect width={doc.width} height={doc.height} fill={doc.background} listening={!editable ? false : true} onMouseDown={() => editable && onSelect?.(null)} />
        {doc.layers.map(renderLayer)}
        {editable && (
          <Transformer
            ref={trRef}
            rotateEnabled={false}
            keepRatio={false}
            ignoreStroke
            anchorSize={8}
            borderStroke="#4F46E5"
            anchorStroke="#4F46E5"
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
          />
        )}
      </Layer>
      {props.showSafeZone && sz && (
        <Layer scaleX={scale} scaleY={scale} listening={false}>
          <Rect name="guide" x={0} y={0} width={doc.width} height={sz.top} fill="rgba(239,68,68,0.12)" />
          <Rect name="guide" x={0} y={doc.height - sz.bottom} width={doc.width} height={sz.bottom} fill="rgba(239,68,68,0.12)" />
          <Rect name="guide" x={0} y={sz.top} width={sz.left} height={doc.height - sz.top - sz.bottom} fill="rgba(239,68,68,0.12)" />
          <Rect name="guide" x={doc.width - sz.right} y={sz.top} width={sz.right} height={doc.height - sz.top - sz.bottom} fill="rgba(239,68,68,0.12)" />
          {(sz.avoidRects ?? []).map((r, i) => (
            <Rect name="guide" key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(239,68,68,0.25)" />
          ))}
          <Line name="guide" points={[sz.left, sz.top, doc.width - sz.right, sz.top, doc.width - sz.right, doc.height - sz.bottom, sz.left, doc.height - sz.bottom, sz.left, sz.top]} stroke="#EF4444" strokeWidth={2 / scale} dash={[10 / scale, 8 / scale]} />
        </Layer>
      )}
    </Stage>
  );
});
