import { ExporterConfiguration } from "../../config"
import { formatFlatDimension, formatStructuredDimension, isPxOrRemUnit } from "../util/units"

/**
 * DTCG `typography` composite only defines: fontFamily, fontSize, fontWeight,
 * letterSpacing, lineHeight.
 *
 * Supernova's TypographyTokenValue additionally carries textDecoration,
 * textCase, paragraphIndent and paragraphSpacing -- none of which have a
 * home in the spec. These are the exact properties the old first-party
 * exporter's README flagged as unsupported ("Missing typography values:
 * (tbd)"), four years on the gap is still there in the spec itself, not
 * just in that exporter.
 */
export type TypographyConversionInput = {
  fontFamily: { text: string }
  fontWeight: { text: string }
  fontSize: { measure: number; unit: string }
  letterSpacing: { measure: number; unit: string } | null
  lineHeight: { measure: number; unit: string } | null
  textCase?: { value: string }
  textDecoration?: { value: string }
  paragraphIndent?: { measure: number; unit: string }
  paragraphSpacing?: { measure: number; unit: string }
}

export type TypographyConversionResult = {
  value: Record<string, unknown>
  warnings: string[]
}

export function convertTypography(
  input: TypographyConversionInput,
  fontWeightNumber: number | string,
  config: ExporterConfiguration,
): TypographyConversionResult {
  const warnings: string[] = []
  const structured = config.valueFormat === "structured"

  const value: Record<string, unknown> = {
    fontFamily: input.fontFamily.text,
    fontWeight: fontWeightNumber,
  }

  value.fontSize = isPxOrRemUnit(input.fontSize.unit)
    ? structured
      ? formatStructuredDimension(input.fontSize.measure, input.fontSize.unit)
      : formatFlatDimension(input.fontSize.measure, input.fontSize.unit)
    : (warnings.push(`fontSize unit "${input.fontSize.unit}" is not px/rem -- left as raw number.`), input.fontSize.measure)

  if (input.letterSpacing) {
    value.letterSpacing = isPxOrRemUnit(input.letterSpacing.unit)
      ? structured
        ? formatStructuredDimension(input.letterSpacing.measure, input.letterSpacing.unit)
        : formatFlatDimension(input.letterSpacing.measure, input.letterSpacing.unit)
      : input.letterSpacing.measure
  }

  // DTCG lineHeight is a bare unitless multiplier of fontSize. Supernova
  // can express line-height as percent (-> divide by 100) or as an
  // absolute px value (-> not representable as a multiplier without also
  // knowing fontSize at read time; we pass the raw number through and warn).
  if (input.lineHeight) {
    if (input.lineHeight.unit === "percent") {
      value.lineHeight = round(input.lineHeight.measure / 100)
    } else if (input.lineHeight.unit === "raw") {
      value.lineHeight = round(input.lineHeight.measure)
    } else {
      warnings.push(
        `lineHeight unit "${input.lineHeight.unit}" is an absolute unit; DTCG expects a unitless multiplier. Exporting raw measure (${input.lineHeight.measure}) -- verify this is correct for your type scale.`,
      )
      value.lineHeight = input.lineHeight.measure
    }
  }
  // null lineHeight ("auto" in Supernova) has no direct DTCG equivalent --
  // omitted rather than guessing a multiplier.

  const dropped: string[] = []
  if (input.textCase) dropped.push("textCase")
  if (input.textDecoration) dropped.push("textDecoration")
  if (input.paragraphIndent) dropped.push("paragraphIndent")
  if (input.paragraphSpacing) dropped.push("paragraphSpacing")
  if (dropped.length) {
    warnings.push(`Typography sub-properties with no DTCG equivalent were ${config.preserveVendorExtensions ? "moved to $extensions" : "dropped"}: ${dropped.join(", ")}.`)
  }

  return { value, warnings }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
