import { ExporterConfiguration } from "../../config";
import { DtcgToken, DtcgType, EXTENSION_NAMESPACE } from "../dtcg-types";
import { ColorReferenceResolver, colorValueToDtcg, SupernovaColorLike } from "./color";
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

const LINE_HEIGHT_TYPE = "lineHeight";

export function convertToken(
  tokenType: string,
  name: string,
  description: string | undefined,
  value: any,
  config: ExporterConfiguration,
  reference?: string,
  resolveReference?: ColorReferenceResolver,
): ConversionResult {
  const warnings: string[] = [];
  const normalizedTokenType = normalizeTokenType(tokenType);

  const base = (
    dtcgType: DtcgType,
    $value: unknown,
    extensions?: Record<string, unknown>,
  ): DtcgToken => {
    const token: DtcgToken = { $type: dtcgType, $value: reference ?? $value };
    if (config.includeDescriptions && description) token.$description = description;
    if (extensions && config.preserveVendorExtensions) {
      token.$extensions = { [EXTENSION_NAMESPACE]: extensions };
    }
    return token;
  };

  // --- Color -------------------------------------------------------------
  if (normalizedTokenType === "color") {
    const v = value as SupernovaColorLike;
    const $value = colorValueToDtcg(v, config, resolveReference);
    return { token: base("color", $value), warnings };
  }

  // --- Dimension family ----------------------------------------------------
  if (DIMENSION_FAMILY_TYPES.has(normalizedTokenType)) {
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

  // Keep standalone line-height values as dimensions for Style Dictionary
  // compatibility, even though DTCG defines line-height as a number.
  if (normalizedTokenType === LINE_HEIGHT_TYPE) {
    const v = value as { measure: number; unit: string };
    if (isPxOrRemUnit(v.unit)) {
      const $value =
        config.valueFormat === "structured"
          ? formatStructuredDimension(v.measure, v.unit)
          : formatFlatDimension(v.measure, v.unit);
      return { token: base("dimension", $value), warnings };
    }

    warnings.push(
      `"${name}" (${tokenType}) has unit "${v.unit}"; exported as a dimension for Style Dictionary compatibility.`,
    );
    const $value = config.valueFormat === "structured"
      ? { value: v.measure, unit: v.unit }
      : `${v.measure}${v.unit === "raw" ? "px" : "%"}`;
    return { token: base("dimension", $value), warnings };
  }

  // --- Duration ------------------------------------------------------------
  if (normalizedTokenType === "duration") {
    const v = value as { measure: number; unit: string };
    return {
      token: base("duration", formatDuration(v.measure, v.unit)),
      warnings,
    };
  }

  // --- Number-ish (opacity, zIndex) ----------------------------------------
  if (normalizedTokenType === "opacity" || normalizedTokenType === "zIndex") {
    const v = value as { measure: number };
    return { token: base("number", v.measure), warnings };
  }

  // --- Font family / weight --------------------------------------------------
  if (normalizedTokenType === "fontFamily") {
    const v = value as { text: string };
    return { token: base("fontFamily", v.text), warnings };
  }
  if (normalizedTokenType === "fontWeight") {
    const v = value as { text: string };
    const result = normalizeFontWeight(v.text);
    if (result.warning) warnings.push(`"${name}": ${result.warning}`);
    return { token: base("fontWeight", result.value), warnings };
  }

  // --- String / product copy ------------------------------------------------
  if (normalizedTokenType === "string" || normalizedTokenType === "productCopy") {
    const v = value as { text: string };
    return { token: base("string", v.text), warnings };
  }

  // --- Composite: typography -------------------------------------------------
  if (normalizedTokenType === "typography") {
    const v = value as TypographyConversionInput;
    const fw = normalizeFontWeight(v.fontWeight.text);
    if (fw.warning) warnings.push(`"${name}": ${fw.warning}`);
    const result = convertTypography(v, fw.value, config, resolveReference);
    warnings.push(...result.warnings.map((w) => `"${name}": ${w}`));
    return { token: base("typography", result.value), warnings };
  }

  // --- Composite: shadow -------------------------------------------------------
  if (normalizedTokenType === "shadow") {
    const v = value as ShadowConversionInput;
    const result = convertShadow(v, config, resolveReference);
    warnings.push(...result.warnings.map((w) => `"${name}": ${w}`));
    return { token: base("shadow", result.value), warnings };
  }

  // --- Composite: border ---------------------------------------------------
  if (normalizedTokenType === "border") {
    const v = value as BorderConversionInput;
    const result = convertBorder(v, config, resolveReference);
    warnings.push(...result.warnings.map((w) => `"${name}": ${w}`));
    return { token: base("border", result.value, result.extensions), warnings };
  }

  // --- Composite: gradient -------------------------------------------------
  if (normalizedTokenType === "gradient") {
    const v = value as GradientConversionInput;
    const result = convertGradient(v, config, resolveReference);
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

export function normalizeTokenType(tokenType: string): string {
  if (tokenType === "BorderRadius") return "radius"
  return tokenType.length > 0
    ? `${tokenType[0].toLowerCase()}${tokenType.slice(1)}`
    : tokenType
}
