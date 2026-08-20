/**
 * Supernova's ColorTokenValue is:
 *   { color: { r, g, b }, opacity: { unit, measure }, referencedTokenId }
 * VERIFY the r/g/b range (0-255 vs 0-1) against the live SDK -- this
 * defensively supports both.
 */
export type SupernovaColorLike = {
  color: { r: number; g: number; b: number }
  opacity: { measure: number } // measure assumed 0-1 for opacity
}

function to255(channel: number): number {
  return channel <= 1 ? Math.round(channel * 255) : Math.round(channel)
}

function toHexPair(n: number): string {
  return n.toString(16).padStart(2, "0")
}

/** Returns "#rrggbb" or "#rrggbbaa" (alpha only appended when < 1). */
export function toHexString(value: SupernovaColorLike): string {
  const r = to255(value.color.r)
  const g = to255(value.color.g)
  const b = to255(value.color.b)
  const a = value.opacity?.measure ?? 1
  const base = `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`
  if (a >= 1) return base
  return `${base}${toHexPair(Math.round(a * 255))}`
}

/** DTCG 2025.10 structured color object (sRGB only -- Supernova has no wide-gamut color model to draw from). */
export function toStructuredColor(value: SupernovaColorLike): {
  colorSpace: "srgb"
  components: [number, number, number]
  alpha?: number
  hex: string
} {
  const r = to255(value.color.r) / 255
  const g = to255(value.color.g) / 255
  const b = to255(value.color.b) / 255
  const a = value.opacity?.measure ?? 1
  const structured: {
    colorSpace: "srgb"
    components: [number, number, number]
    alpha?: number
    hex: string
  } = {
    colorSpace: "srgb",
    components: [round(r), round(g), round(b)],
    hex: toHexString(value),
  }
  if (a < 1) structured.alpha = round(a)
  return structured
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
