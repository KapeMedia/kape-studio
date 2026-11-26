import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

let cached: Uint8Array | null = null;

/**
 * AUTH_SECRET from env, or (dev) a random secret persisted in .data/auth-secret,
 * so proxy and server bundles share it across restarts.
 */
export function getAuthSecret(): Uint8Array {
  if (cached) return cached;
  let secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.VERCEL) {
      throw new Error("AUTH_SECRET lipsește în producție.");
    }
    const file = path.join(process.cwd(), ".data", "auth-secret");
    try {
      secret = fs.readFileSync(file, "utf8").trim();
    } catch {
      secret = crypto.randomBytes(32).toString("hex");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, secret);
      console.warn("[auth] AUTH_SECRET lipsește: am generat unul în .data/auth-secret (doar pentru dev).");
    }
  }
  cached = new TextEncoder().encode(secret);
  return cached;
}
