import {
  Supernova,
  PulsarContext,
  RemoteVersionIdentifier,
  AnyOutputFile,
  AnyToken,
} from "@supernovaio/sdk-exporters";

import { ExporterConfiguration } from "../config";
import { FileHelper } from "@supernovaio/export-helpers";

import { buildDtcgTree, PlacedToken } from "./build-tree";
import { convertToken, normalizeTokenType } from "./convert";
import { pathToAliasReference, resolveTokenPath, MinimalGroup } from "./util/path";

export const exportConfiguration = Pulsar.exportConfig<ExporterConfiguration>();

Pulsar.export(
  async (
    sdk: Supernova,
    context: PulsarContext,
  ): Promise<Array<AnyOutputFile>> => {
    // Fetch data from design system that is currently being exported (context)
    const remoteVersionIdentifier: RemoteVersionIdentifier = {
      designSystemId: context.dsId,
      versionId: context.versionId,
    };

    // ------------------------------------------------------------
    // Fetch tokens and groups
    // ------------------------------------------------------------

    let tokens = await sdk.tokens.getTokens(remoteVersionIdentifier);
    let tokenGroups = await sdk.tokens.getTokenGroups(remoteVersionIdentifier);

    // ------------------------------------------------------------
    // Apply brand filtering
    // ------------------------------------------------------------

    if (context.brandId) {
      const brands = await sdk.brands.getBrands(remoteVersionIdentifier);

      const brand = brands.find(
        (brand) =>
          brand.id === context.brandId || brand.idInVersion === context.brandId,
      );

      if (!brand) {
        throw new Error(`Unable to find brand ${context.brandId}.`);
      }

      tokens = tokens.filter((token) => token.brandId === brand.id);

      tokenGroups = tokenGroups.filter((group) => group.brandId === brand.id);
    }

    const baseTokens = tokens;
    const tokenSets: Array<{ tokens: typeof tokens; themeName?: string }> = [];
    if (exportConfiguration.includeBaseValues || !context.themeIds?.length) {
      tokenSets.push({ tokens: baseTokens });
    }

    // ------------------------------------------------------------
    // Apply themes
    // ------------------------------------------------------------

    if (context.themeIds && context.themeIds.length > 0) {
      const themes = await sdk.tokens.getTokenThemes(remoteVersionIdentifier);

      const themesToApply = context.themeIds.map((themeId) => {
        const theme = themes.find(
          (theme) => theme.id === themeId || theme.idInVersion === themeId,
        );

        if (!theme) {
          throw new Error(`Unable to find theme ${themeId}.`);
        }

        return theme;
      });

      const appliedThemeName = themesToApply
        .map((theme: any) => String(theme.name ?? theme.idInVersion ?? theme.id))
        .join("-");

      tokenSets.push({
        tokens: sdk.tokens.computeTokensByApplyingThemes(
          baseTokens,
          baseTokens,
          themesToApply,
        ),
        themeName: appliedThemeName,
      });
    }

    // ------------------------------------------------------------
    // Build a group lookup for path resolution
    // ------------------------------------------------------------
    // NB: field names for parent/isRoot on TokenGroup are still unconfirmed
    // (only used as a fallback when a token's own `tokenPath` is null) --
    // if grouping looks wrong for ungrouped tokens, this is the next thing
    // to check against a real SDKTokenGroup.d.ts.
    const groupsById = new Map<string, MinimalGroup>(
      tokenGroups.map((g: any) => [
        g.id,
        {
          id: g.id,
          parentId: g.parentGroupId ?? null,
          name: g.name,
          isRoot: g.isRoot,
        },
      ]),
    );

    const outputFiles: AnyOutputFile[] = [];

    for (const tokenSet of tokenSets) {
      const placedTokens: PlacedToken[] = [];
      const warnings: string[] = [];
      const tokenPathsById = new Map<string, string>();
      const tokensForOutput = tokenSet.tokens;

      for (const token of tokensForOutput) {
      const typedToken = token as AnyToken;
      const path = resolveTokenPath(typedToken as any, groupsById);
      tokenPathsById.set(typedToken.id, pathToAliasReference(path));
      tokenPathsById.set(typedToken.idInVersion, pathToAliasReference(path));
      }

      for (const token of tokensForOutput) {
      const typedToken = token as AnyToken;
      const referencedTokenId = (typedToken.value as any)?.referencedTokenId;
      const reference = referencedTokenId
        ? tokenPathsById.get(referencedTokenId)
        : undefined;

      const converted = convertToken(
        typedToken.tokenType,
        typedToken.name,
        typedToken.description,
        typedToken.value,
        exportConfiguration,
        reference,
        (tokenId) => tokenPathsById.get(tokenId),
      );

      warnings.push(...converted.warnings);

      if (!converted.token) {
        continue;
      }

      placedTokens.push({
        // FIXED: tokenPath is the group ancestry only -- it does not
        // include the token's own name. Using it alone (as before)
        // discarded every token's name and collided tokens at their
        // parent group's key.
        path: resolveTokenPath(typedToken as any, groupsById),
        tokenType: normalizeTokenType(typedToken.tokenType),
        token: converted.token,
      });
      }

      const outputPath = tokenSet.themeName
        ? resolveOutputPath(exportConfiguration.themeOutputPath, tokenSet.themeName)
        : resolveOutputPath(exportConfiguration.baseOutputPath);

      if (exportConfiguration.outputFileStructure === "single-file") {
        const document = buildDtcgTree(placedTokens);
        outputFiles.push(
        FileHelper.createTextFile({
          relativePath: outputPath,
          fileName: `${exportConfiguration.outputFileName}.json`,
          content: JSON.stringify(document, null, 2),
        }),
        );
        continue;
      }

      const tokensByType = new Map<string, PlacedToken[]>();
      for (const placedToken of placedTokens) {
        const typeTokens = tokensByType.get(placedToken.tokenType) ?? [];
        typeTokens.push(placedToken);
        tokensByType.set(placedToken.tokenType, typeTokens);
      }

      outputFiles.push(
        ...[...tokensByType.entries()].map(([tokenType, typeTokens]) => {
          const document = buildDtcgTree(typeTokens);
          return FileHelper.createTextFile({
            relativePath: outputPath,
            fileName: `${tokenType}.json`,
            content: JSON.stringify(document, null, 2),
          });
        }),
      );
    }

    return outputFiles;
  },
);

function resolveOutputPath(template: string, themeName?: string): string {
  const path = template.replace(
    "{theme}",
    themeName ? themeName.replace(/[\\/]/g, "-") : "",
  );
  const normalized = path.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return normalized === "." || normalized === "" ? "./" : `${normalized}/`;
}
