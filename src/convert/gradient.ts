import { ExporterConfiguration } from "../../config"
import { toHexString, toStructuredColor, SupernovaColorLike } from "./color"

/**
 * DTCG `gradient` is JUST an array of { color, position } stops -- no
 * direction, no linear-vs-radial, no angle. That's a real, spec-level gap
 * (the spec's own editors have an open question about it), not something
 * we can work around on the exporter side.
 *
 * Supernova's GradientTokenValue carries `to`/`from` coordinates, `type`
 * (linear/radial), and `aspectRatio` -- all of which get dropped from the
 * $value and, if preserveVendorExtensions is on, preserved in $extensions.
 * Style Dictionary / CSS output generated from the DTCG file alone will
 * NOT reconstruct the original gradient angle or radial shape -- flag this
 * clearly to consumers of the exported file.
 */
export type GradientConversionInput = {
  type: string // "linear" | "radial"
  from: { x: number; y: number }
  to: { x: number; y: number }
  aspectRatio: number
  stops: Array<{ position: number; color: SupernovaColorLike }>
}

export function convertGradient(input: GradientConversionInput, config: ExporterConfiguration): { value: unknown[]; warnings: string[]; extensions?: Record<string, unknown> } {
  const structured = config.valueFormat === "structured"

  const value = input.stops.map((stop) => ({
    color: structured ? toStructuredColor(stop.color) : toHexString(stop.color),
    position: round(stop.position),
  }))

  const warnings = [
    `Gradient direction/type (${input.type}) and coordinates are not representable in DTCG's gradient type -- ${config.preserveVendorExtensions ? "preserved in $extensions but NOT used by downstream CSS/platform output" : "dropped"}. Verify rendered gradients after the Style Dictionary build.`,
  ]

  const extensions = config.preserveVendorExtensions
    ? { type: input.type, from: input.from, to: input.to, aspectRatio: input.aspectRatio }
    : undefined

  return { value, warnings, extensions }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
