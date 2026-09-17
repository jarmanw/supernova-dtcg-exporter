import { ExporterConfiguration } from "../../config"
import { colorValueToDtcg, SupernovaColorLike, ColorReferenceResolver } from "./color"
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
  x: number | { measure: number; unit: string }
  y: number | { measure: number; unit: string }
  radius: number | { measure: number; unit: string }
  spread: number | { measure: number; unit: string }
  opacity?: { measure: number }
  type: string // e.g. "outer" | "inner" -- verify against SDK
}

export function convertShadow(input: ShadowConversionInput | ShadowConversionInput[], config: ExporterConfiguration, resolveReference?: ColorReferenceResolver): { value: Record<string, unknown>[]; warnings: string[] } {
  const warnings: string[] = []
  const structured = config.valueFormat === "structured"

  const values = (Array.isArray(input) ? input : [input]).map((layer) => {
    const dim = (d: number | { measure: number; unit: string }, label: string) => {
      if (typeof d === "number") {
        return structured
          ? formatStructuredDimension(d, "px")
          : formatFlatDimension(d, "px")
      }
      if (!isPxOrRemUnit(d.unit)) {
        warnings.push(`Shadow ${label} unit "${d.unit}" is not px/rem -- exported as a raw number.`)
        return d.measure
      }
      return structured ? formatStructuredDimension(d.measure, d.unit) : formatFlatDimension(d.measure, d.unit)
    }

    const combinedColor: SupernovaColorLike = {
      color: layer.color.color,
      opacity: { measure: (layer.color.opacity?.measure ?? 1) * (layer.opacity?.measure ?? 1) },
      referencedTokenId: layer.color.referencedTokenId,
    }

    const value: Record<string, unknown> = {
      color: colorValueToDtcg(combinedColor, config, resolveReference),
      offsetX: dim(layer.x, "offsetX"),
      offsetY: dim(layer.y, "offsetY"),
      blur: dim(layer.radius, "blur"),
      spread: dim(layer.spread, "spread"),
    }

    if (layer.type && layer.type.toLowerCase().includes("inner")) {
      value.inset = true
    }

    return value
  })

  return { value: values, warnings }
}
