import { ExporterConfiguration } from "../../config";
import { DtcgToken, DtcgType, EXTENSION_NAMESPACE } from "../dtcg-types";
import { toHexString, toStructuredColor, SupernovaColorLike } from "./color";
import { normalizeFontWeight } from "./fontWeight";
import { convertTypography, TypographyConversionInput } from "./typography";
import { convertShadow, ShadowConversionInput } from "./shadow";
import { convertBorder, BorderConversionInput } from "./border";
import { convertGradient, GradientConversionInput } from "./gradient";
import {
  formatFlatDimension,
  formatStructuredDimension,
  formatDuration,
  isPxOrRemUnit,
} from "../util/units";

export type ConversionResult = {
  token: DtcgToken | null; // null => skip this token entirely (unmappable + config says drop)
  warnings: string[];
};

/**
 * Supnova token types that all resolve to a plain {unit, measure} value
 * and map cleanly onto DTCG's single generic `dimension` $type.
 * VERIFY these string keys against the live TokenType enum.
 */
const DIMENSION_FAMILY_TYPES = new Set([
  "dimension",
  "size",
  "space",
  "fontSize",
  "letterSpacing",
  "paragraphSpacing",
  "borderWidth",
  "radius",
]);

export function convertToken(
  tokenType: string,
  name: string,
  description: string | undefined,
  value: any,
  config: ExporterConfiguration,
): ConversionResult {
  const warnings: string[] = [];

  const base = (
    dtcgType: DtcgType,
    $value: unknown,
    extensions?: Record<string, unknown>,
  ): DtcgToken => {
    const token: DtcgToken = { $type: dtcgType, $value };
    if (description) token.$description = description;
    if (extensions && config.preserveVendorExtensions) {
      token.$extensions = { [EXTENSION_NAMESPACE]: extensions };
    }
    return token;
  };

  // --- Color -------------------------------------------------------------
  if (tokenType === "color") {
    const v = value as SupernovaColorLike;
    const $value =
      config.valueFormat === "structured"
        ? toStructuredColor(v)
        : toHexString(v);
    return { token: base("color", $value), warnings };
  }

  // --- Dimension family ----------------------------------------------------
  if (DIMENSION_FAMILY_TYPES.has(tokenType)) {
    const v = value as { measure: number; unit: string };
    if (!isPxOrRemUnit(v.unit)) {
      warnings.push(
        `"${name}" (${tokenType}) has unit "${v.unit}", which DTCG's dimension type doesn't support (px/rem only). Exported as $type: "number" instead.`,
      );
      return { token: base("number", v.measure), warnings };
    }
    const $value =
      config.valueFormat === "structured"
        ? formatStructuredDimension(v.measure, v.unit)
        : formatFlatDimension(v.measure, v.unit);
    return { token: base("dimension", $value), warnings };
  }

  // --- Duration ------------------------------------------------------------
  if (tokenType === "duration") {
    const v = value as { measure: number; unit: string };
    return {
      token: base("duration", formatDuration(v.measure, v.unit)),
      warnings,
    };
  }

  // --- Number-ish (opacity, zIndex) ----------------------------------------
  if (tokenType === "opacity" || tokenType === "zIndex") {
    const v = value as { measure: number };
    return { token: base("number", v.measure), warnings };
  }

  // --- Font family / weight --------------------------------------------------
  if (tokenType === "fontFamily") {
    const v = value as { text: string };
    return { token: base("fontFamily", v.text), warnings };
  }
  if (tokenType === "fontWeight") {
    const v = value as { text: string };
    const result = normalizeFontWeight(v.text);
    if (result.warning) warnings.push(`"${name}": ${result.warning}`);
    return { token: base("fontWeight", result.value), warnings };
  }

  // --- String / product copy ------------------------------------------------
  if (tokenType === "string" || tokenType === "productCopy") {
    const v = value as { text: string };
    return { token: base("string", v.text), warnings };
  }

  // --- Composite: typography -------------------------------------------------
  if (tokenType === "typography") {
    const v = value as TypographyConversionInput;
    const fw = normalizeFontWeight(v.fontWeight.text);
    if (fw.warning) warnings.push(`"${name}": ${fw.warning}`);
    const result = convertTypography(v, fw.value, config);
    warnings.push(...result.warnings.map((w) => `"${name}": ${w}`));
    return { token: base("typography", result.value), warnings };
  }

  // --- Composite: shadow -------------------------------------------------------
  if (tokenType === "shadow") {
    const v = value as ShadowConversionInput;
    const result = convertShadow(v, config);
    warnings.push(...result.warnings.map((w) => `"${name}": ${w}`));
    return { token: base("shadow", result.value), warnings };
  }

  // --- Composite: border ---------------------------------------------------
  if (tokenType === "border") {
    const v = value as BorderConversionInput;
    const result = convertBorder(v, config);
    warnings.push(...result.warnings.map((w) => `"${name}": ${w}`));
    return { token: base("border", result.value, result.extensions), warnings };
  }

  // --- Composite: gradient -------------------------------------------------
  if (tokenType === "gradient") {
    const v = value as GradientConversionInput;
    const result = convertGradient(v, config);
    warnings.push(...result.warnings.map((w) => `"${name}": ${w}`));
    return {
      token: base("gradient", result.value, result.extensions),
      warnings,
    };
  }

  // --- No DTCG equivalent at all: textCase, textDecoration, visibility, blur --
  if (!config.includeUnmappableTokenTypes) {
    warnings.push(
      `"${name}" (${tokenType}) has no DTCG equivalent and includeUnmappableTokenTypes is off -- skipped.`,
    );
    return { token: null, warnings };
  }
  warnings.push(
    `"${name}" (${tokenType}) has no DTCG equivalent -- exported as $type: "string" with the raw value tagged in $extensions.`,
  );
  const rawText =
    typeof value === "object" && value && "value" in value
      ? String((value as any).value)
      : JSON.stringify(value);
  return {
    token: base("string", rawText, { originalTokenType: tokenType }),
    warnings,
  };
}
