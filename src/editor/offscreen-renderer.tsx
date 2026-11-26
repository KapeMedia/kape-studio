"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { DocumentCanvas, type DocumentCanvasHandle, type TextMetrics } from "./document-canvas";
import { toFileUrl } from "./template-preview";
import type { FontSource } from "./fonts";
import type { VariantDocument } from "@/lib/template-types";

export type RenderResult = { blob: Blob; metrics: TextMetrics };
export type OffscreenRendererHandle = { render: (doc: VariantDocument) => Promise<RenderResult> };

type Job = { id: number; doc: VariantDocument; resolve: (r: RenderResult) => void; reject: (e: unknown) => void };

/** Renders documents at full resolution in a hidden Konva stage, one at a time. */
export const OffscreenRenderer = forwardRef<OffscreenRendererHandle, { fonts: FontSource[] }>(function OffscreenRenderer({ fonts }, ref) {
  const queue = useRef<Job[]>([]);
  const counter = useRef(0);
  const busy = useRef(false);
  const [job, setJob] = useState<Job | null>(null);
  const canvas = useRef<DocumentCanvasHandle>(null);

  useImperativeHandle(ref, () => ({
    render: (doc) =>
      new Promise<RenderResult>((resolve, reject) => {
        const j = { id: ++counter.current, doc, resolve, reject };
        queue.current.push(j);
        if (!busy.current) {
          busy.current = true;
          setJob(queue.current.shift() ?? null);
        }
      }),
  }));

  useEffect(() => {
    if (!job) return;
    let alive = true;
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 50));
        await canvas.current?.whenReady();
        const url = canvas.current?.toDataURL("image/png");
        if (!url) throw new Error("Randarea a eșuat");
        const blob = await (await fetch(url)).blob();
        job.resolve({ blob, metrics: canvas.current?.getTextMetrics() ?? {} });
      } catch (e) {
        job.reject(e);
      } finally {
        if (alive) {
          const next = queue.current.shift() ?? null;
          busy.current = !!next;
          setJob(next);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [job]);

  if (!job) return null;
  return (
    <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
      <DocumentCanvas key={job.id} ref={canvas} doc={job.doc} displayWidth={job.doc.width >= job.doc.height ? 480 : 360} fonts={fonts} fileUrl={toFileUrl} />
    </div>
  );
});

/** Uploads the rendered master preview (+ overflow ids) so the server re-runs QA. */
export async function uploadPreview(variantId: string, r: RenderResult, formatKey: string) {
  const fd = new FormData();
  fd.set("file", new File([r.blob], "preview.png", { type: "image/png" }));
  fd.set("overflow", JSON.stringify({ [formatKey]: Object.entries(r.metrics).filter(([, m]) => m.overflow).map(([id]) => id) }));
  const res = await fetch(`/api/variants/${variantId}/preview`, { method: "POST", body: fd });
  return res.ok ? ((await res.json()) as { qa: unknown }) : null;
}
