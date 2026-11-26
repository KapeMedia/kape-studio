"use client";

import dynamic from "next/dynamic";

const Loading = () => <div className="h-full min-h-24 w-full animate-pulse rounded bg-gray-100" />;

/** Konva needs the browser: every canvas component is loaded client-side only. */
export const TemplatePreviewLazy = dynamic(() => import("./template-preview").then((m) => m.TemplatePreview), {
  ssr: false,
  loading: Loading,
});

export const PreviewBakerLazy = dynamic(() => import("./preview-baker").then((m) => m.PreviewBaker), { ssr: false });

export const VariantEditorLazy = dynamic(() => import("./variant-editor").then((m) => m.VariantEditor), {
  ssr: false,
  loading: () => <div className="h-[600px] w-full animate-pulse rounded-lg bg-gray-100" />,
});
