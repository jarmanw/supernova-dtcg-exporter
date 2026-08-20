import { ExporterConfiguration } from "../../config"
import { toHexString, toStructuredColor, SupernovaColorLike } from "./color"
import { formatFlatDimension, formatStructuredDimension, isPxOrRemUnit } from "../util/units"

/**
 * DTCG `shadow`: { color, offsetX, offsetY, blur, spread, inset? }
 * Supernova ShadowTokenValue: { color, x, y, radius, spread, opacity, type }
 *
 * Two modeling decisions worth flagging:
 *  - Supernova stores shadow opacity separately from the shadow color's own
 *    opacity. We fold shadow.opacity into the emitted color's alpha
 *    (color.opacity * shadow.opacity), since DTCG only has one alpha slot.
 *  - `type` ("outer"/"inner" or similar) maps to DTCG's boolean `inset`.
 *    VERIFY the exact string Supernova uses for inner shadows.
 */
export type ShadowConversionInput = {
  color: SupernovaColorLike
  x: { measure: number; unit: string }
  y: { measure: number; unit: string }
  radius: { measure: number; unit: string }
  spread: { measure: number; unit: string }
  opacity: { measure: number }
  type: string // e.g. "outer" | "inner" -- verify against SDK
}

export function convertShadow(input: ShadowConversionInput, config: ExporterConfiguration): { value: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = []
  const structured = config.valueFormat === "structured"

  const dim = (d: { measure: number; unit: string }, label: string) => {
    if (!isPxOrRemUnit(d.unit)) {
      warnings.push(`Shadow ${label} unit "${d.unit}" is not px/rem -- exported as a raw number.`)
      return d.measure
    }
    return structured ? formatStructuredDimension(d.measure, d.unit) : formatFlatDimension(d.measure, d.unit)
  }

  const combinedColor: SupernovaColorLike = {
    color: input.color.color,
    opacity: { measure: (input.color.opacity?.measure ?? 1) * (input.opacity?.measure ?? 1) },
  }

  const value: Record<string, unknown> = {
    color: structured ? toStructuredColor(combinedColor) : toHexString(combinedColor),
    offsetX: dim(input.x, "offsetX"),
    offsetY: dim(input.y, "offsetY"),
    blur: dim(input.radius, "blur"),
    spread: dim(input.spread, "spread"),
  }

  if (input.type && input.type.toLowerCase().includes("inner")) {
    value.inset = true
  }

  return { value, warnings }
}
