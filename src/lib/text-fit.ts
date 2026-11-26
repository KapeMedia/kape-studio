/** Measures the rendered width (px) of `text` at `fontSize`. Injectable for tests/server. */
export type Measurer = (text: string, fontSize: number) => number;

export type FitInput = {
  text: string;
  width: number;
  height: number;
  maxSize: number;
  minSize: number;
  lineHeight: number;
  measure: Measurer;
};

export type FitResult = { fontSize: number; lines: string[]; overflow: boolean; textHeight: number; maxLineWidth: number };

/** Word wrap without hyphenation. A single word wider than the box stays on its own line (it overflows). */
export function wrapWords(text: string, width: number, fontSize: number, measure: Measurer): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = words[0]!;
    for (const w of words.slice(1)) {
      const candidate = `${line} ${w}`;
      if (measure(candidate, fontSize) <= width) line = candidate;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

function layout(input: FitInput, size: number) {
  const lines = wrapWords(input.text, input.width, size, input.measure);
  const widths = lines.map((l) => input.measure(l, size));
  const maxLineWidth = Math.max(0, ...widths);
  const textHeight = lines.length * size * input.lineHeight;
  const fits = textHeight <= input.height + 0.5 && maxLineWidth <= input.width + 0.5;
  return { lines, maxLineWidth, textHeight, fits };
}

/**
 * Shrinks the font from maxSize down to minSize (step 1px) until the text fits the box.
 * If even minSize does not fit → overflow: true (QA flags `text_overflow`).
 */
export function fitText(input: FitInput): FitResult {
  const max = Math.max(input.minSize, Math.floor(input.maxSize));
  const min = Math.max(1, Math.floor(input.minSize));
  if (!input.text.trim()) return { fontSize: max, lines: [], overflow: false, textHeight: 0, maxLineWidth: 0 };
  for (let size = max; size >= min; size--) {
    const l = layout(input, size);
    if (l.fits) return { fontSize: size, lines: l.lines, overflow: false, textHeight: l.textHeight, maxLineWidth: l.maxLineWidth };
  }
  const l = layout(input, min);
  return { fontSize: min, lines: l.lines, overflow: true, textHeight: l.textHeight, maxLineWidth: l.maxLineWidth };
}

/** Rough measurer for the server (no real font): average glyph width ≈ 0.56em (0.66em for caps). */
export const approxMeasure: Measurer = (text, fontSize) => {
  let w = 0;
  for (const ch of text) {
    if (ch === " ") w += 0.28;
    else if (/[A-ZĂÂÎȘȚ0-9%]/.test(ch)) w += 0.66;
    else if (/[iljtfrI.,:;!'’]/.test(ch)) w += 0.32;
    else if (/[mwMW]/.test(ch)) w += 0.85;
    else w += 0.55;
  }
  return w * fontSize;
};
