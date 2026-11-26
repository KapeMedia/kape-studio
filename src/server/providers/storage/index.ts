import crypto from "node:crypto";
import { LocalStorageProvider } from "./local";
import { SupabaseStorageProvider } from "./supabase";
import { extFromMime, type StorageProvider } from "./types";

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "supabase" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    instance = new SupabaseStorageProvider();
  } else {
    if (driver === "vercel-blob") {
      console.warn("[storage] vercel-blob nu e implementat în v1; folosesc local. Vezi DECISIONS.md.");
    }
    instance = new LocalStorageProvider();
  }
  return instance;
}

/** Builds a unique storage key like `clients/<id>/logo/<uuid>.png`. */
export function makeKey(prefix: string, mimeType: string): string {
  return `${prefix.replace(/\/$/, "")}/${crypto.randomUUID()}.${extFromMime(mimeType)}`;
}

export { fileUrl } from "./types";
