/**
 * Supernova's SDK exposes a `Unit` enum on every {unit, measure} token value
 * (Dimension, Size, Space, FontSize, LineHeight, LetterSpacing,
 * ParagraphSpacing, BorderWidth, Radius, Duration, ZIndex, Opacity).
 *
 * VERIFY: the exact member names below against the live `Unit` enum from
 * `@supernovaio/sdk-exporters` inside VS Code autocomplete before shipping --
 * this mapping is built from documented examples ("Unit.raw") plus the
 * obvious candidates (px/rem/pt/percent/ms/s), not a confirmed enum dump.
 */
export const UNIT_TO_DTCG_LENGTH: Record<string, "px" | "rem" | null> = {
  px: "px",
  pixels: "px",
  rem: "rem",
  // DTCG's `dimension` type (this draft) only permits "px" or "rem".
  // Anything else has no direct home -- null signals "cannot express as
  // a spec-legal dimension, fall back to string/number + a warning".
  pt: null,
  percent: null,
  raw: null,
}

export function isPxOrRemUnit(unit: string): boolean {
  return UNIT_TO_DTCG_LENGTH[unit] != null
}

/**
 * Formats a Supernova {unit, measure} pair as a DTCG "flat" dimension
 * string, e.g. "16px" / "1.5rem". Only call this when isPxOrRemUnit(unit)
 * is true.
 */
export function formatFlatDimension(measure: number, unit: string): string {
  const dtcgUnit = UNIT_TO_DTCG_LENGTH[unit]
  if (!dtcgUnit) {
    throw new Error(`Unit "${unit}" cannot be expressed as a DTCG dimension string.`)
  }
  return `${trimNumber(measure)}${dtcgUnit}`
}

/** Formats a Supernova {unit, measure} pair as a DTCG "structured" dimension object. */
export function formatStructuredDimension(measure: number, unit: string): { value: number; unit: "px" | "rem" } {
  const dtcgUnit = UNIT_TO_DTCG_LENGTH[unit]
  if (!dtcgUnit) {
    throw new Error(`Unit "${unit}" cannot be expressed as a DTCG dimension object.`)
  }
  return { value: measure, unit: dtcgUnit }
}

/** Duration has no legacy string form in the spec -- always {value, unit}. */
export function formatDuration(measure: number, unit: string): { value: number; unit: "ms" | "s" } {
  const dtcgUnit = unit === "ms" || unit === "s" ? unit : "ms"
  return { value: measure, unit: dtcgUnit }
}

/** Strips trailing .0 / floating noise so "16.0" -> "16", "1.50" stays useful precision. */
export function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)))
}
