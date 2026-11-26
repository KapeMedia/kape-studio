import fs from "node:fs/promises";
import path from "node:path";
import { MIME_BY_EXT, type StorageProvider } from "./types";

export class LocalStorageProvider implements StorageProvider {
  id = "local" as const;
  constructor(private root = path.join(process.cwd(), ".data", "uploads")) {}

  private resolve(key: string): string {
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = path.join(this.root, safe);
    if (!full.startsWith(this.root)) throw new Error("Cheie de fișier invalidă");
    return full;
  }

  async put(key: string, data: Buffer, mimeType: string) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    await fs.writeFile(full + ".mime", mimeType);
  }

  async get(key: string) {
    const full = this.resolve(key);
    try {
      const data = await fs.readFile(full);
      let mimeType: string;
      try {
        mimeType = (await fs.readFile(full + ".mime", "utf8")).trim();
      } catch {
        mimeType = MIME_BY_EXT[path.extname(full).slice(1).toLowerCase()] ?? "application/octet-stream";
      }
      return { data, mimeType };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    const full = this.resolve(key);
    await fs.rm(full, { force: true });
    await fs.rm(full + ".mime", { force: true });
  }
}
