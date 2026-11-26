import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DB } from "../../db/connect";
import { brainEntries, brainEntryEvents, references, styleVersions, styles, variants, type BrainEntry, type Client, type Format, type Style, type StyleVersion } from "../../db/schema";
import type { ContextExample, ContextRuleRef, ContextSnapshot } from "@/lib/types";
import { normalizeDiacritics } from "@/lib/diacritics";

export const CONTEXT_VERSION = "ctx-1";

export const ROLE_TEXT =
  "Ești directorul de creație al agenției KAPE Media (marketing digital, Oradea/Craiova, România). Creezi bannere statice on-brand pentru clienții agenției: copy scurt în română corectă și direcția vizuală pentru imagine.";

export const PRIORITY_RULE =
  "Dacă brief-ul contrazice o regulă, urmează brief-ul. Dacă o regulă a clientului contrazice stilul, urmează regula clientului.";

const FORMAT_GUIDE: Record<string, string> = {
  feed_4x5: "Feed 4:5 (1080×1350): formatul principal în Feed; textul are loc generos, dar headline-ul trebuie citit dintr-o privire.",
  feed_1x1: "Feed 1:1 (1080×1080): pătrat, folosit și în carusel; mai puțin spațiu vertical, copy mai scurt.",
  story_9x16: "Story 9:16 (1080×1920): ecran complet vertical; sus ~14% și jos ~18% sunt acoperite de interfața Instagram/Facebook, deci textul și logo-ul stau doar în zona din mijloc; text mare, lizibil pe telefon.",
  landscape_191: "Landscape 1.91:1 (1200×628): orizontal, pentru link ads / Audience Network; textul în jumătatea stângă.",
  fb_cover: "Cover Facebook (1640×624, afișat ~820×312): text și logo doar în zona centrală; colțul stânga-jos e acoperit de poza de profil.",
};

export type ContextInput = {
  client: Client;
  style: (Style & { version: StyleVersion }) | null;
  formats: Pick<Format, "key" | "label" | "safeZone" | "notes">[];
  brief: { message: string; cta: string; notes: string; formats: string[]; angles: { type: string; headline: string; subheadline?: string; cta: string }[] };
  agencyRules: BrainEntry[];
  clientEntries: BrainEntry[];
  examples: ContextExample[];
  now?: Date;
};

/** Does an entry's scope apply to this generation's formats/style? Empty scope = everywhere. */
export function scopeMatches(scope: { formats?: string[]; styles?: string[] }, formats: string[], style: { id: string; slug: string; name: string } | null): boolean {
  if (scope.formats?.length && !scope.formats.some((f) => formats.includes(f))) return false;
  if (scope.styles?.length) {
    if (!style) return false;
    const names = [style.id, style.slug, style.name.toLowerCase()];
    if (!scope.styles.some((s) => names.includes(s) || names.includes(s.toLowerCase()))) return false;
  }
  return true;
}

function ruleRef(e: BrainEntry, level: "agency" | "client"): ContextRuleRef {
  return {
    id: e.id,
    text: normalizeDiacritics(e.text),
    status: e.status === "active" ? "active" : "trial",
    level,
    pinned: e.pinned,
    sourceQuote: e.source?.quote ? e.source.quote.slice(0, 140) : undefined,
    sourceAuthor: e.source?.authorName,
    sourceDate: e.source?.date,
  };
}

const sortRules = (a: BrainEntry, b: BrainEntry) => Number(b.pinned) - Number(a.pinned) || b.createdAt.getTime() - a.createdAt.getTime();

function ruleLine(r: ContextRuleRef) {
  const src = r.sourceQuote ? ` (sursa: ${[r.sourceAuthor, r.sourceDate].filter(Boolean).join(", ")}: «${r.sourceQuote}»)` : "";
  return `- [${r.pinned ? "fixată" : r.status === "active" ? "fixă" : "în probă"}] ${r.text}${src}`;
}

/** Pure: assembles the structured context + the prompt string, in priority order (SPEC §10.3). */
export function assembleContext(input: ContextInput): ContextSnapshot {
  const { client, style, formats, brief } = input;
  const styleRef = style ? { id: style.id, slug: style.slug, name: style.name } : null;
  const fmtKeys = brief.formats;

  const agencyRules = input.agencyRules
    .filter((e) => e.status === "active" && e.kind === "rule" && scopeMatches(e.scope, fmtKeys, styleRef))
    .sort(sortRules)
    .map((e) => ruleRef(e, "agency"));
  const applicable = input.clientEntries.filter((e) => e.status !== "archived" && scopeMatches(e.scope, fmtKeys, styleRef)).sort(sortRules);
  const clientRules = applicable.filter((e) => e.status === "active" && e.kind === "rule").map((e) => ruleRef(e, "client"));
  const trialRules = applicable.filter((e) => e.status === "trial" && e.kind === "rule").map((e) => ruleRef(e, "client"));
  const facts = applicable.filter((e) => e.kind !== "rule" && e.status === "active").map((e) => ruleRef(e, "client"));

  const formatInstructions = formats
    .filter((f) => fmtKeys.includes(f.key))
    .map((f) => ({
      key: f.key,
      label: f.label,
      text: `${FORMAT_GUIDE[f.key] ?? f.label} Safe zone: sus ${f.safeZone.top}px, jos ${f.safeZone.bottom}px, lateral ${f.safeZone.left}px.${f.notes ? ` ${f.notes}` : ""}`,
    }));

  const snapshot: Omit<ContextSnapshot, "prompt"> = {
    role: ROLE_TEXT,
    agencyRules,
    formatInstructions,
    style: style
      ? {
          id: style.id,
          name: style.name,
          versionId: style.version.id,
          version: style.version.version,
          description: style.description,
          copyGuidance: style.version.copyGuidance,
          visualPrompt: style.version.visualPrompt,
          avoid: style.version.avoid,
          textMode: style.version.textMode,
        }
      : null,
    client: {
      name: client.name,
      industry: client.industry,
      description: client.description,
      audience: client.audience,
      tone: client.tone,
      dos: client.dos,
      donts: client.donts,
      activeOffers: client.activeOffers,
      colors: client.colors.map((c) => ({ name: c.name, hex: c.hex, role: c.role })),
    },
    clientRules,
    trialRules,
    facts,
    examples: input.examples,
    brief: { message: brief.message, cta: brief.cta, notes: brief.notes, formats: fmtKeys, angles: brief.angles },
    priorityRule: PRIORITY_RULE,
    usedEntryIds: [...agencyRules, ...clientRules, ...trialRules, ...facts].map((r) => r.id),
    builtAt: (input.now ?? new Date()).toISOString(),
  };

  const sec = (title: string, body: string) => (body.trim() ? `## ${title}\n${body.trim()}\n` : "");
  const c = snapshot.client;
  const prompt = [
    `# ROL\n${snapshot.role}\n`,
    sec("1. Reguli de agenție (fixe)", agencyRules.map(ruleLine).join("\n")),
    sec("2. Instrucțiuni de format", formatInstructions.map((f) => `- ${f.text}`).join("\n")),
    snapshot.style
      ? sec(
          `3. Stil: ${snapshot.style.name} (v${snapshot.style.version})`,
          [`Descriere: ${snapshot.style.description}`, `Ghid de copy: ${snapshot.style.copyGuidance}`, `Direcție vizuală: ${snapshot.style.visualPrompt}`, `De evitat: ${snapshot.style.avoid}`, `Mod text: ${snapshot.style.textMode}`].join("\n"),
        )
      : sec("3. Stil", "Alege tu direcția vizuală potrivită brief-ului."),
    sec(
      `4. Client: ${c.name}`,
      [
        `Industrie: ${c.industry}`,
        c.description && `Descriere: ${c.description}`,
        c.audience && `Public: ${c.audience}`,
        c.tone && `Ton: ${c.tone}`,
        c.dos && `Ce facem: ${c.dos}`,
        c.donts && `Ce evităm: ${c.donts}`,
        c.activeOffers && `Oferte active: ${c.activeOffers}`,
        c.colors.length && `Culori: ${c.colors.map((x) => `${x.name} ${x.hex} (${x.role})`).join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    sec("5. Reguli fixe ale clientului (respectă-le)", clientRules.map(ruleLine).join("\n")),
    sec("6. Reguli în probă ale clientului (aplică-le, sunt în testare)", trialRules.map(ruleLine).join("\n")),
    sec("Fapte și preferințe despre client", facts.map(ruleLine).join("\n")),
    sec(
      "7. Exemple din istoricul clientului",
      input.examples
        .map((e) => `- ${e.kind === "approved" ? "APROBAT" : "RESPINS"}: „${e.headline}”${e.subheadline ? ` / „${e.subheadline}”` : ""} / CTA „${e.cta}”. Vizual: ${e.visual.slice(0, 200)}${e.reason ? ` Motiv respingere: ${e.reason}` : ""}`)
        .join("\n"),
    ),
    sec(
      "8. Brief-ul utilizatorului",
      [
        `Mesaj / ofertă: ${brief.message}`,
        brief.cta && `CTA dorit: ${brief.cta}`,
        brief.notes && `Note: ${brief.notes}`,
        `Formate: ${fmtKeys.join(", ")}`,
        brief.angles.length && `Unghiuri alese:\n${brief.angles.map((a) => `  - ${a.type}: „${a.headline}”${a.subheadline ? ` / „${a.subheadline}”` : ""} / CTA „${a.cta}”`).join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    `## 9. Prioritate\n${PRIORITY_RULE}\n`,
  ]
    .filter(Boolean)
    .join("\n");

  return { ...snapshot, prompt };
}

/** Loads approved/rejected examples for the client (prefer same style). */
export async function loadExamples(db: DB, clientId: string, styleVersionIds: string[]): Promise<ContextExample[]> {
  const rows = await db
    .select({ ref: references, variant: variants })
    .from(references)
    .innerJoin(variants, eq(variants.id, references.sourceVariantId))
    .where(and(eq(references.clientId, clientId), inArray(references.kind, ["approved_example", "rejected_example"])))
    .orderBy(desc(references.createdAt))
    .limit(40);
  const score = (v: typeof variants.$inferSelect) => (v.styleVersionId && styleVersionIds.includes(v.styleVersionId) ? 1 : 0);
  const approved = rows.filter((r) => r.ref.kind === "approved_example").sort((a, b) => score(b.variant) - score(a.variant)).slice(0, 5);
  const rejected = rows.filter((r) => r.ref.kind === "rejected_example").sort((a, b) => score(b.variant) - score(a.variant)).slice(0, 3);
  return [...approved, ...rejected].map(({ ref, variant }) => ({
    variantId: variant.id,
    kind: ref.kind === "approved_example" ? "approved" : "rejected",
    headline: variant.copy.headline,
    subheadline: variant.copy.subheadline,
    cta: variant.copy.cta,
    visual: variant.visualPrompt,
    reason: ref.kind === "rejected_example" ? ref.note || variant.rejectReason || undefined : undefined,
  }));
}

/** DB wrapper: loads rules/examples, assembles the context, and marks used entries (uses++, lastUsedAt, event). */
export async function buildContext(
  db: DB,
  args: { client: Client; styleId: string | null; formats: Format[]; brief: ContextInput["brief"]; markUsed?: boolean },
): Promise<{ snapshot: ContextSnapshot; style: (Style & { version: StyleVersion }) | null }> {
  let style: (Style & { version: StyleVersion }) | null = null;
  if (args.styleId) {
    const [s] = await db.select().from(styles).where(eq(styles.id, args.styleId));
    if (s?.currentVersionId) {
      const [v] = await db.select().from(styleVersions).where(eq(styleVersions.id, s.currentVersionId));
      if (v) style = { ...s, version: v };
    }
  }
  const entries = await db
    .select()
    .from(brainEntries)
    .where(and(or(isNull(brainEntries.clientId), eq(brainEntries.clientId, args.client.id)), sql`${brainEntries.status} <> 'archived'`));
  const examples = await loadExamples(db, args.client.id, style ? [style.version.id] : []);
  const snapshot = assembleContext({
    client: args.client,
    style,
    formats: args.formats,
    brief: args.brief,
    agencyRules: entries.filter((e) => e.clientId === null),
    clientEntries: entries.filter((e) => e.clientId === args.client.id),
    examples,
  });
  if (args.markUsed !== false && snapshot.usedEntryIds.length) {
    const now = new Date();
    await db
      .update(brainEntries)
      .set({ uses: sql`${brainEntries.uses} + 1`, lastUsedAt: now })
      .where(inArray(brainEntries.id, snapshot.usedEntryIds));
    await db.insert(brainEntryEvents).values(snapshot.usedEntryIds.map((id) => ({ entryId: id, type: "used" as const, data: {} })));
  }
  return { snapshot, style };
}
