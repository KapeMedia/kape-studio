import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  BrainScope,
  BrainSource,
  BrandColor,
  BriefInput,
  ContextSnapshot,
  FeedbackInterpretation,
  QaResult,
  SafeZone,
  VariantCopy,
} from "@/lib/types";
import type { TemplateDefinition, VariantDocument } from "@/lib/template-types";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "editor"] }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const clients = pgTable("clients", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry", { enum: ["beauty", "food", "hospitality", "other"] })
    .notNull()
    .default("other"),
  description: text("description").notNull().default(""),
  audience: text("audience").notNull().default(""),
  tone: text("tone").notNull().default(""),
  dos: text("dos").notNull().default(""),
  donts: text("donts").notNull().default(""),
  activeOffers: text("active_offers").notNull().default(""),
  colors: jsonb("colors").$type<BrandColor[]>().notNull().default([]),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const brandAssets = pgTable("brand_assets", {
  id: id(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  type: text("type", { enum: ["logo", "logo_light", "photo", "font", "other"] }).notNull(),
  name: text("name").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  meta: jsonb("meta")
    .$type<{
      family?: string;
      weight?: number;
      style?: string;
      role?: "heading" | "body";
      missingGlyphs?: string[];
    }>()
    .notNull()
    .default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const projects = pgTable("projects", {
  id: id(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const references = pgTable("references", {
  id: id(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  projectId: uuid("project_id").references(() => projects.id),
  storageKey: text("storage_key"),
  note: text("note").notNull().default(""),
  kind: text("kind", { enum: ["inspiration", "approved_example", "rejected_example"] }).notNull(),
  sourceVariantId: uuid("source_variant_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const formats = pgTable("formats", {
  id: id(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  safeZone: jsonb("safe_zone").$type<SafeZone>().notNull(),
  notes: text("notes").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const templates = pgTable("templates", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  definition: jsonb("definition").$type<TemplateDefinition>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const styles = pgTable("styles", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  whenToUse: text("when_to_use").notNull().default(""),
  currentVersionId: uuid("current_version_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const styleVersions = pgTable("style_versions", {
  id: id(),
  styleId: uuid("style_id")
    .notNull()
    .references(() => styles.id),
  version: integer("version").notNull(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => templates.id),
  visualPrompt: text("visual_prompt").notNull().default(""),
  avoid: text("avoid").notNull().default(""),
  copyGuidance: text("copy_guidance").notNull().default(""),
  referenceAssetKeys: jsonb("reference_asset_keys").$type<string[]>().notNull().default([]),
  textMode: text("text_mode", { enum: ["overlay", "full_ai"] }).notNull().default("overlay"),
  changelog: text("changelog").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const generations = pgTable("generations", {
  id: id(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  createdBy: uuid("created_by").references(() => users.id),
  brief: jsonb("brief").$type<BriefInput>().notNull(),
  status: text("status", { enum: ["queued", "running", "done", "failed"] })
    .notNull()
    .default("queued"),
  error: text("error"),
  contextSnapshot: jsonb("context_snapshot").$type<ContextSnapshot>(),
  llmProvider: text("llm_provider"),
  imageProvider: text("image_provider"),
  costUsd: doublePrecision("cost_usd").notNull().default(0),
  usage: jsonb("usage").$type<Record<string, number>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const variants = pgTable("variants", {
  id: id(),
  generationId: uuid("generation_id")
    .notNull()
    .references(() => generations.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  index: integer("index").notNull(),
  angle: text("angle").notNull().default(""),
  copy: jsonb("copy").$type<VariantCopy>().notNull(),
  styleVersionId: uuid("style_version_id").references(() => styleVersions.id),
  masterFormatKey: text("master_format_key").notNull(),
  /** Documents per format. The master format is always present once composed. */
  documents: jsonb("documents").$type<Record<string, VariantDocument>>().notNull().default({}),
  documentVersion: integer("document_version").notNull().default(1),
  visualPrompt: text("visual_prompt").notNull().default(""),
  backgroundAssetKey: text("background_asset_key"),
  previewKey: text("preview_key"),
  status: text("status", {
    enum: ["pending", "failed", "draft", "in_review", "approved", "rejected", "delivered"],
  })
    .notNull()
    .default("pending"),
  error: text("error"),
  qa: jsonb("qa").$type<QaResult>(),
  rationale: text("rationale").notNull().default(""),
  rejectReason: text("reject_reason"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const feedback = pgTable("feedback", {
  id: id(),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => variants.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  authorId: uuid("author_id").references(() => users.id),
  text: text("text").notNull(),
  interpretation: jsonb("interpretation").$type<FeedbackInterpretation>(),
  createdBrainEntryIds: jsonb("created_brain_entry_ids").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const brainEntries = pgTable("brain_entries", {
  id: id(),
  clientId: uuid("client_id").references(() => clients.id),
  kind: text("kind", { enum: ["rule", "fact", "preference"] }).notNull().default("rule"),
  text: text("text").notNull(),
  status: text("status", { enum: ["trial", "active", "archived"] }).notNull().default("trial"),
  scope: jsonb("scope").$type<BrainScope>().notNull().default({}),
  confirmations: integer("confirmations").notNull().default(0),
  uses: integer("uses").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  pinned: boolean("pinned").notNull().default(false),
  source: jsonb("source").$type<BrainSource>(),
  createdBy: text("created_by", { enum: ["user", "ai"] }).notNull().default("user"),
  suggestAgencyWide: boolean("suggest_agency_wide").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const brainEntryEvents = pgTable("brain_entry_events", {
  id: id(),
  entryId: uuid("entry_id")
    .notNull()
    .references(() => brainEntries.id),
  type: text("type", {
    enum: ["created", "confirmed", "promoted", "edited", "archived", "restored", "used"],
  }).notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  actorId: uuid("actor_id").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const llmCalls = pgTable("llm_calls", {
  id: id(),
  generationId: uuid("generation_id").references(() => generations.id),
  clientId: uuid("client_id").references(() => clients.id),
  purpose: text("purpose", {
    enum: ["angles", "copy", "feedback_interpret", "qa_vision", "image", "test"],
  }).notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  imageCount: integer("image_count").notNull().default(0),
  costUsd: doublePrecision("cost_usd").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  ok: boolean("ok").notNull().default(true),
  error: text("error"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Key/value app settings (e.g. default image provider chosen in UI). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>(),
  updatedAt: updatedAt(),
});

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type BrandAsset = typeof brandAssets.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Reference = typeof references.$inferSelect;
export type Format = typeof formats.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Style = typeof styles.$inferSelect;
export type StyleVersion = typeof styleVersions.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type BrainEntry = typeof brainEntries.$inferSelect;
export type BrainEntryEvent = typeof brainEntryEvents.$inferSelect;
export type LlmCall = typeof llmCalls.$inferSelect;
