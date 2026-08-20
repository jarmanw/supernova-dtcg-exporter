/**
 * Minimal typing for the subset of the DTCG format we emit.
 * Deliberately loose ($value: unknown) because the shape of $value
 * legitimately differs per $type, and per valueFormat (flat vs structured).
 */

export type DtcgType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "duration"
  | "number"
  | "string"
  | "typography"
  | "shadow"
  | "border"
  | "gradient"

export type DtcgToken = {
  $value: unknown
  $type?: DtcgType
  $description?: string
  $extensions?: Record<string, unknown>
}

export type DtcgGroup = {
  $description?: string
  $type?: DtcgType
  [tokenOrGroupName: string]: DtcgToken | DtcgGroup | string | DtcgType | undefined
}

export type DtcgDocument = Record<string, DtcgToken | DtcgGroup>

/** Vendor extension namespace we write unsupported properties under. */
export const EXTENSION_NAMESPACE = "io.supernova.exporter"
