import type { CopyInput } from "../providers/llm/types";

export const COPY_PROMPT_VERSION = "copy-1";

export function copyPrompt(input: CopyInput): string {
  const angles = input.angles.length
    ? `Folosește unghiurile alese de utilizator, în ordine, repartizate pe variante (poți păstra textele lor sau să le rafinezi ușor):\n${input.angles
        .map((a) => `- ${a.type}: „${a.headline}”${a.subheadline ? ` / „${a.subheadline}”` : ""} / CTA „${a.cta}”`)
        .join("\n")}`
    : "Alege tu un unghi diferit pentru fiecare variantă (oferta, durere, rezultat, social_proof, urgenta).";
  const photos = input.brandPhotos.length
    ? `Pozele reale ale clientului (poți seta useBrandPhotoKey cu cheia exactă dacă o poză reală e mai potrivită decât o imagine generată):\n${input.brandPhotos.map((p) => `- ${p.key} (${p.name})`).join("\n")}`
    : "Clientul nu are poze proprii; nu seta useBrandPhotoKey.";
  const fullAi = input.style?.textMode === "full_ai";
  return `${input.contextPrompt}

# SARCINA: copy + direcție vizuală pentru ${input.variantCount} variante
${angles}

Pentru fiecare variantă (index de la 0 la ${input.variantCount - 1}):
- angle: tipul unghiului.
- headline: maxim 7 cuvinte (dacă ghidul de copy al stilului nu spune altfel), română corectă.
- subheadline: opțional, o propoziție scurtă.
- cta: scurt, la imperativ.
- extra.price: procentul sau prețul DOAR dacă apare în brief (ex: „-40%”, „39 lei”); altfel omite.
- extra.badge: o dată sau o etichetă scurtă DOAR dacă reiese din brief (ex: „30 NOIEMBRIE”); altfel omite.
- visualPrompt: în engleză, descrie DOAR imaginea: subiect, compoziție, lumină, stil (${input.style ? `stilul „${input.style.name}”: ${input.style.visualPrompt}` : "potrivit brief-ului"}), paleta brandului ca mood (${input.palette.map((p) => `${p.name} ${p.hex}`).join(", ") || "neutră"}), zona liberă pentru text la ${input.negativeSpaceHint}.${
    fullAi
      ? ` Modul stilului e full_ai: include în imagine textul exact al headline-ului și CTA-ului, între ghilimele, scris corect cu diacritice. Fără logo.`
      : ` Termină cu: "No text, no letters, no numbers, no logos, no watermarks."`
  }${input.style?.avoid ? ` Evită: ${input.style.avoid}.` : ""}
- negativeSpace: unde lasă imaginea loc pentru text (de regulă „${input.negativeSpaceHint}”, după template).
- useBrandPhotoKey: opțional.
- rationale: în română, o propoziție: de ce ai ales asta și ce reguli ai aplicat.

${photos}
Variantele trebuie să difere între ele (unghi, imagine), nu doar prin cuvinte.`;
}
