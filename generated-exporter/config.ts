/**
 * Mirrors config.json exactly. Keep in sync by hand -- Supernova does not
 * generate this for you.
 */
export type ExporterConfiguration = {
  valueFormat: "flat" | "structured"
  outputFileStructure: "single-file" | "per-type"
  outputFileName: string
  preserveVendorExtensions: boolean
  includeUnmappableTokenTypes: boolean
  showGeneratedFileDisclaimer: boolean
}
