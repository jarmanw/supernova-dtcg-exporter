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
import { convertToken } from "./convert";
import { resolveTokenPath, MinimalGroup } from "./util/path";

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

      tokens = sdk.tokens.computeTokensByApplyingThemes(
        tokens,
        tokens,
        themesToApply,
      );
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

    // ------------------------------------------------------------
    // Convert Supernova tokens into DTCG tokens
    // ------------------------------------------------------------

    const placedTokens: PlacedToken[] = [];
    const warnings: string[] = [];

    for (const token of tokens) {
      const typedToken = token as AnyToken;

      const converted = convertToken(
        typedToken.tokenType,
        typedToken.name,
        typedToken.description,
        typedToken.value,
        exportConfiguration,
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
        token: converted.token,
      });
    }

    // ------------------------------------------------------------
    // Build DTCG document
    // ------------------------------------------------------------

    const document = buildDtcgTree(placedTokens) as Record<string, unknown>;

    const content = JSON.stringify(document, null, 2);

    if (warnings.length) {
      console.warn(`DTCG export completed with ${warnings.length} warning(s):`);
      for (const w of warnings) console.warn(`  - ${w}`);
    }

    // ------------------------------------------------------------
    // Output
    // ------------------------------------------------------------

    return [
      FileHelper.createTextFile({
        relativePath: "./",
        fileName: "tokens.json",
        content,
      }),
    ];
  },
);
