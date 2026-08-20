/**
 * DTCG fontWeight $value MUST be either a number in [1, 1000] or one of a
 * fixed set of keyword aliases. Supernova's FontWeightTokenValue is a free
 * text field ({ text: "bold" | "300" | "Semi Bold" | ... }), so we have to
 * normalize it and there is no guarantee every design system's free text
 * survives losslessly -- unrecognized values fall back to 400 with a
 * warning rather than emitting spec-illegal output.
 */
const KEYWORD_TO_NUMBER: Record<string, number> = {
  thin: 100,
  hairline: 100,
  "extra-light": 200,
  "extralight": 200,
  "ultra-light": 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  "semi-bold": 600,
  semibold: 600,
  "demi-bold": 600,
  demibold: 600,
  bold: 700,
  "extra-bold": 800,
  extrabold: 800,
  "ultra-bold": 800,
  black: 900,
  heavy: 900,
  "extra-black": 950,
  extrablack: 950,
  "ultra-black": 950,
}

export type FontWeightResult = { value: number | string; warning?: string }

function normalizeKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "-")
}

export function normalizeFontWeight(text: string): FontWeightResult {
  const asNumber = Number(text)
  if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= 1000) {
    return { value: asNumber }
  }

  const key = normalizeKey(text)
  if (key in KEYWORD_TO_NUMBER) {
    // Emit the numeric form -- it's valid under both string and numeric
    // syntax and avoids relying on keyword spelling matching exactly.
    return { value: KEYWORD_TO_NUMBER[key] }
  }

  return {
    value: 400,
    warning: `Font weight "${text}" is not a number in [1,1000] or a recognized DTCG keyword. Falling back to 400 (normal).`,
  }
}
