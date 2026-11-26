import type { FeedbackInput } from "../providers/llm/types";

export const FEEDBACK_PROMPT_VERSION = "feedback-1";

export function feedbackPrompt(input: FeedbackInput): string {
  return `# SARCINA: interpretează feedback-ul echipei pe un banner

Bannerul: headline „${input.variant.headline}”${input.variant.subheadline ? `, subheadline „${input.variant.subheadline}”` : ""}, CTA „${input.variant.cta}”, stil ${input.variant.style ?? "nespecificat"}, format ${input.variant.format}.

Comentariul echipei (citat exact):
«${input.comment}»

Regulile existente ale clientului:
${input.existingRules.map((r) => `- [${r.id}] (${r.status}) ${r.text}`).join("\n") || "(niciuna)"}

Formate disponibile: ${input.availableFormats.join(", ")}. Stiluri disponibile: ${input.availableStyles.join(", ")}.

Separă comentariul în:
1. oneOff: ce trebuie schimbat DOAR la bannerul ăsta (instrucțiune clară), sau null.
2. rules: preferințe care trebuie ținute minte pentru clientul ăsta data viitoare. Fiecare regulă: scurtă, la imperativ, reutilizabilă (ex: „Pe story, headline-ul minim 90 px.”, „Nu folosi poze cu femei în costum de baie.”). scope.formats / scope.styles doar dacă regula se aplică clar doar acolo (folosește cheile de mai sus); altfel lasă gol. Dacă e aceeași idee ca o regulă existentă, pune matchesExistingRuleId cu id-ul ei. isAgencyWide = true doar dacă pare valabilă pentru toți clienții agenției.
3. summary: în română, începe cu „Am înțeles” și enumeră ce ai înțeles, de ex.: „Am înțeles 2 lucruri: (1) …: regulă nouă în probă; (2) …: doar pentru bannerul ăsta.”

Nu transforma în regulă ceva ce ține doar de bannerul curent.`;
}
