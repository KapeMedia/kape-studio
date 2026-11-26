import { slugify } from "./utils";

/** `client_proiect_stil_format_v{index}.png` (SPEC M4). */
export function exportFileName(parts: { client: string; project: string; style: string | null; format: string; index: number }): string {
  const s = (x: string) => slugify(x).replace(/-/g, "-") || "x";
  return `${s(parts.client)}_${s(parts.project)}_${s(parts.style ?? "stil")}_${parts.format}_v${parts.index}.png`;
}
