import { ExporterConfiguration } from "../../config"
import { toHexString, toStructuredColor, SupernovaColorLike } from "./color"
import { formatFlatDimension, formatStructuredDimension, isPxOrRemUnit } from "../util/units"

/**
 * DTCG `border`: { color, width, style }
 * Supernova BorderTokenValue: { color, width, position, style }
 *
 * `position` (inside/outside/center) has no DTCG equivalent -- CSS borders
 * don't have this concept either (they're effectively "center" always, or
 * emulated with box-shadow/outline). Dropped into $extensions rather than
 * silently discarded, since it can matter for hand-off to design tools.
 */
export type BorderConversionInput = {
  color: SupernovaColorLike
  width: { measure: number; unit: string }
  position: string
  style: string // "solid" | "dotted" | "dashed" | "groove" -- assumed to already match DTCG strokeStyle keywords
}

export function convertBorder(input: BorderConversionInput, config: ExporterConfiguration): { value: Record<string, unknown>; warnings: string[]; extensions?: Record<string, unknown> } {
  const warnings: string[] = []
  const structured = config.valueFormat === "structured"

  const width = isPxOrRemUnit(input.width.unit)
    ? structured
      ? formatStructuredDimension(input.width.measure, input.width.unit)
      : formatFlatDimension(input.width.measure, input.width.unit)
    : (warnings.push(`Border width unit "${input.width.unit}" is not px/rem -- exported as a raw number.`), input.width.measure)

  const value: Record<string, unknown> = {
    color: structured ? toStructuredColor(input.color) : toHexString(input.color),
    width,
    style: input.style,
  }

  let extensions: Record<string, unknown> | undefined
  if (input.position) {
    warnings.push(`Border "position" (${input.position}) has no DTCG equivalent -- ${config.preserveVendorExtensions ? "stored in $extensions" : "dropped"}.`)
    if (config.preserveVendorExtensions) {
      extensions = { position: input.position }
    }
  }

  return { value, warnings, extensions }
}
