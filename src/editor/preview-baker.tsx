"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentCanvas, type DocumentCanvasHandle } from "./document-canvas";
import { toFileUrl } from "./template-preview";
import type { FontSource } from "./fonts";
import type { VariantDocument } from "@/lib/template-types";

export type BakeJob = { variantId: string; doc: VariantDocument; version: number };

/**
 * Renders documents off-screen with Konva (real fonts) and uploads the full-resolution PNG
 * as the variant preview, together with the text-overflow metrics. One job at a time.
 */
export function PreviewBaker({ jobs, fonts, onDone }: { jobs: BakeJob[]; fonts: FontSource[]; onDone: (variantId: string) => void }) {
  const [current, setCurrent] = useState<BakeJob | null>(null);
  const done = useRef(new Set<string>());
  const ref = useRef<DocumentCanvasHandle>(null);

  useEffect(() => {
    if (current) return;
    const next = jobs.find((j) => !done.current.has(`${j.variantId}:${j.version}`));
    if (next) setCurrent(next);
  }, [jobs, current]);

  useEffect(() => {
    if (!current) return;
    let alive = true;
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 50));
        await ref.current?.whenReady();
        const url = ref.current?.toDataURL("image/png");
        const metrics = ref.current?.getTextMetrics() ?? {};
        if (!url) throw new Error("render failed");
        const blob = await (await fetch(url)).blob();
        const fd = new FormData();
        fd.set("file", new File([blob], "preview.png", { type: "image/png" }));
        fd.set("overflow", JSON.stringify({ [current.doc.formatKey]: Object.entries(metrics).filter(([, m]) => m.overflow).map(([id]) => id) }));
        await fetch(`/api/variants/${current.variantId}/preview`, { method: "POST", body: fd });
      } catch (e) {
        console.warn("[preview-baker]", e);
      } finally {
        done.current.add(`${current.variantId}:${current.version}`);
        if (alive) {
          onDone(current.variantId);
          setCurrent(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [current, onDone]);

  if (!current) return null;
  return (
    <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 400, pointerEvents: "none" }}>
      <DocumentCanvas key={`${current.variantId}:${current.version}`} ref={ref} doc={current.doc} displayWidth={360} fonts={fonts} fileUrl={toFileUrl} />
    </div>
  );
}
