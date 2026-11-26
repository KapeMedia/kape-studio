import type { DB } from "../db/connect";
import type { Client } from "../db/schema";
import { listBrandAssets } from "./clients";
import { paletteFromColors, type Palette } from "@/lib/colors";
import { fileUrl } from "../providers/storage/types";

export type BrandContext = {
  palette: Palette;
  fonts: { heading: string; body: string };
  fontSources: { family: string; url: string }[];
  logo: string | null;
  logoLight: string | null;
  photos: { key: string; name: string }[];
};

/** Everything the renderer / resolver needs about a client's brand. */
export async function getBrandContext(db: DB, client: Client | null): Promise<BrandContext> {
  if (!client) {
    return { palette: paletteFromColors([]), fonts: { heading: "Inter", body: "Inter" }, fontSources: [], logo: null, logoLight: null, photos: [] };
  }
  const assets = await listBrandAssets(db, client.id);
  const fonts = assets.filter((a) => a.type === "font");
  const heading = fonts.find((f) => f.meta.role === "heading") ?? fonts[0];
  const body = fonts.find((f) => f.meta.role === "body") ?? heading;
  return {
    palette: paletteFromColors(client.colors),
    fonts: { heading: heading ? `brand-${heading.id}` : "Inter", body: body ? `brand-${body.id}` : "Inter" },
    fontSources: fonts.map((f) => ({ family: `brand-${f.id}`, url: fileUrl(f.storageKey)! })),
    logo: assets.find((a) => a.type === "logo")?.storageKey ?? null,
    logoLight: assets.find((a) => a.type === "logo_light")?.storageKey ?? null,
    photos: assets.filter((a) => a.type === "photo").map((a) => ({ key: a.storageKey, name: a.name })),
  };
}
