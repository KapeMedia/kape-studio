import type { StorageProvider } from "./types";

/**
 * Supabase Storage via its REST API (no SDK dependency).
 * Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET (private bucket).
 * Files are still served through /api/files (same origin), so the bucket can stay private.
 */
export class SupabaseStorageProvider implements StorageProvider {
  id = "supabase" as const;
  private url = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  private key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  private bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "kape-studio";

  private endpoint(key: string) {
    return `${this.url}/storage/v1/object/${this.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.key}`, apikey: this.key, ...extra };
  }

  async put(key: string, data: Buffer, mimeType: string) {
    const res = await fetch(this.endpoint(key), {
      method: "POST",
      headers: this.headers({ "Content-Type": mimeType, "x-upsert": "true" }),
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Supabase Storage: upload eșuat (${res.status})`);
  }

  async get(key: string) {
    const res = await fetch(this.endpoint(key), { headers: this.headers() });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`Supabase Storage: citire eșuată (${res.status})`);
    return {
      data: Buffer.from(await res.arrayBuffer()),
      mimeType: res.headers.get("content-type") ?? "application/octet-stream",
    };
  }

  async delete(key: string) {
    await fetch(`${this.url}/storage/v1/object/${this.bucket}`, {
      method: "DELETE",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: [key] }),
    });
  }
}
