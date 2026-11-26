import type { VisionInput } from "../providers/llm/types";

export const QA_PROMPT_VERSION = "qa-vision-1";

export function visionPrompt(input: VisionInput): string {
  return `# SARCINA: verificare de calitate a unui banner (imaginea atașată)

Textul așteptat: headline „${input.expectedCopy.headline}”${input.expectedCopy.subheadline ? `, subheadline „${input.expectedCopy.subheadline}”` : ""}, CTA „${input.expectedCopy.cta}”.
Mod text: ${input.textMode === "full_ai" ? "textul e generat în imagine: verifică literă cu literă, inclusiv diacriticele" : "textul e pus de aplicație peste imagine"}.
Industrie: ${input.industry}.
Regulile clientului:
${input.rules.map((r) => `- ${r}`).join("\n") || "(niciuna)"}

Semnalează doar probleme reale, fiecare cu severity „warning” sau „error” și un mesaj scurt în română:
- text ilizibil (contrast slab, prea mic, acoperit);
- text greșit sau cu greșeli (mai ales în full_ai);
- încălcarea unei reguli a clientului;
- imagini before/after sau mesaje despre corp (avertisment de politică Meta pentru nișa beauty): warning;
- artefacte AI evidente (mâini, fețe, obiecte deformate, text parazit în imagine).
Dacă nu e nicio problemă, întoarce issues: [].`;
}
