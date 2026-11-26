export interface StorageProvider {
  id: "local" | "supabase" | "vercel-blob";
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; mimeType: string } | null>;
  delete(key: string): Promise<void>;
}

export const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  json: "application/json",
};

export function extFromMime(mime: string): string {
  const found = Object.entries(MIME_BY_EXT).find(([, m]) => m === mime);
  return found?.[0] ?? "bin";
}

/** URL under which the app serves a stored file (same origin, so canvas is never tainted). */
export function fileUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}
