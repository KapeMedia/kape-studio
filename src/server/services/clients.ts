import { and, asc, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "../db/connect";
import { brandAssets, clients, projects, references } from "../db/schema";
import { brandColorSchema } from "@/lib/types";
import { normalizeDeep } from "@/lib/diacritics";
import { slugify } from "@/lib/utils";

export const clientInputSchema = z.object({
  name: z.string().trim().min(2, "Numele e prea scurt").max(80),
  industry: z.enum(["beauty", "food", "hospitality", "other"]).default("other"),
  description: z.string().default(""),
  audience: z.string().default(""),
  tone: z.string().default(""),
  dos: z.string().default(""),
  donts: z.string().default(""),
  activeOffers: z.string().default(""),
  colors: z.array(brandColorSchema).max(16).default([]),
});
export type ClientInput = z.input<typeof clientInputSchema>;

export const INDUSTRY_LABELS: Record<string, string> = {
  beauty: "Beauty",
  food: "Food",
  hospitality: "Hospitality",
  other: "Altele",
};

export async function listClients(db: DB, opts: { includeArchived?: boolean } = {}) {
  return db
    .select()
    .from(clients)
    .where(opts.includeArchived ? undefined : isNull(clients.archivedAt))
    .orderBy(asc(clients.name));
}

export async function listArchivedClients(db: DB) {
  return db.select().from(clients).where(isNotNull(clients.archivedAt)).orderBy(asc(clients.name));
}

export async function getClientBySlug(db: DB, slug: string) {
  const [c] = await db.select().from(clients).where(eq(clients.slug, slug));
  return c ?? null;
}

export async function getClientById(db: DB, id: string) {
  const [c] = await db.select().from(clients).where(eq(clients.id, id));
  return c ?? null;
}

async function uniqueSlug(db: DB, base: string, excludeId?: string) {
  const root = slugify(base) || "client";
  let slug = root;
  for (let i = 2; i < 100; i++) {
    const [existing] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, slug));
    if (!existing || existing.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export async function createClient(db: DB, input: ClientInput) {
  const data = normalizeDeep(clientInputSchema.parse(input));
  const slug = await uniqueSlug(db, data.name);
  const [c] = await db.insert(clients).values({ ...data, slug }).returning();
  return c!;
}

export async function updateClient(db: DB, id: string, input: Partial<ClientInput>) {
  const data = normalizeDeep(clientInputSchema.partial().parse(input));
  const [c] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
  return c!;
}

export async function setClientArchived(db: DB, id: string, archived: boolean) {
  await db.update(clients).set({ archivedAt: archived ? new Date() : null }).where(eq(clients.id, id));
}

// ---------- brand assets ----------
export async function listBrandAssets(db: DB, clientId: string) {
  return db.select().from(brandAssets).where(eq(brandAssets.clientId, clientId)).orderBy(asc(brandAssets.createdAt));
}

// ---------- projects ----------
export async function listProjects(db: DB, clientId: string, opts: { includeArchived?: boolean } = {}) {
  return db
    .select()
    .from(projects)
    .where(opts.includeArchived ? eq(projects.clientId, clientId) : and(eq(projects.clientId, clientId), eq(projects.status, "active")))
    .orderBy(desc(projects.createdAt));
}

export async function getProject(db: DB, id: string) {
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  return p ?? null;
}

export const projectInputSchema = z.object({
  name: z.string().trim().min(2, "Numele e prea scurt").max(100),
  description: z.string().default(""),
});

export async function createProject(db: DB, clientId: string, input: z.input<typeof projectInputSchema>) {
  const data = normalizeDeep(projectInputSchema.parse(input));
  const [p] = await db.insert(projects).values({ clientId, ...data }).returning();
  return p!;
}

export async function updateProject(db: DB, id: string, input: Partial<z.input<typeof projectInputSchema>> & { status?: "active" | "archived" }) {
  const { status, ...rest } = input;
  const data = normalizeDeep(projectInputSchema.partial().parse(rest));
  const [p] = await db.update(projects).set({ ...data, ...(status ? { status } : {}) }).where(eq(projects.id, id)).returning();
  return p!;
}

export async function listProjectReferences(db: DB, projectId: string) {
  return db.select().from(references).where(eq(references.projectId, projectId)).orderBy(desc(references.createdAt));
}
