import "server-only";
import type { DB } from "@/server/db/connect";
import { getClientBySlug, listClients } from "@/server/services/clients";
import { getBrandContext } from "@/server/services/brand";
import { listFormats } from "@/server/services/library";
import type { BrandView } from "@/editor/template-preview";
import type { FormatSpec } from "@/lib/derive";

export async function loadPreviewContext(db: DB, clientSlug?: string) {
  const clients = await listClients(db);
  const client = (clientSlug ? await getClientBySlug(db, clientSlug) : null) ?? clients[0] ?? null;
  const ctx = await getBrandContext(db, client);
  const brand: BrandView = { palette: ctx.palette, fonts: ctx.fonts, fontSources: ctx.fontSources, logo: ctx.logo, logoLight: ctx.logoLight };
  const formats = await listFormats(db);
  const specs: FormatSpec[] = formats.map((f) => ({ key: f.key, width: f.width, height: f.height, safeZone: f.safeZone }));
  const spec = (key: string) => specs.find((f) => f.key === key) ?? specs[0]!;
  return { clients: clients.map((c) => ({ slug: c.slug, name: c.name })), client, brand, formats, specs, spec, photos: ctx.photos };
}
