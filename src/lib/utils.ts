import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const dtf = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });
const df = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dtf.format(typeof d === "string" ? new Date(d) : d);
}
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return df.format(typeof d === "string" ? new Date(d) : d);
}
export function formatUsd(n: number): string {
  return `$${n.toFixed(n > 0 && n < 0.01 ? 4 : 2)}`;
}
