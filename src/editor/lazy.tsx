"use client";

import dynamic from "next/dynamic";

const Loading = () => <div className="h-full min-h-24 w-full animate-pulse rounded bg-gray-100" />;

/** Konva needs the browser: every canvas component is loaded client-side only. */
export const TemplatePreviewLazy = dynamic(() => import("./template-preview").then((m) => m.TemplatePreview), {
  ssr: false,
  loading: Loading,
});
