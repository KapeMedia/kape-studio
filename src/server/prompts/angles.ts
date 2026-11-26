import type { AnglesInput } from "../providers/llm/types";

export const ANGLES_PROMPT_VERSION = "angles-1";

export function anglesPrompt(input: AnglesInput): string {
  return `${input.contextPrompt}

# SARCINA: unghiuri de comunicare
Propune între 3 și 5 unghiuri diferite pentru acest brief. Tipuri posibile: oferta, durere, rezultat, social_proof, urgenta, altul.
Pentru fiecare unghi: id scurt (a1, a2…), type, headline (maxim 7 cuvinte, dacă ghidul stilului nu spune altfel), subheadline opțional (o propoziție scurtă), cta (scurt, la imperativ${input.brief.cta ? `; folosește „${input.brief.cta}” dacă se potrivește` : ""}), why (de ce funcționează, o propoziție).
Unghiurile trebuie să fie cu adevărat diferite între ele.`;
}
