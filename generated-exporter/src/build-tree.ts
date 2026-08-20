import { DtcgDocument, DtcgToken } from "./dtcg-types"

export type PlacedToken = {
  path: string[] // e.g. ["color", "ui-elements", "primary"]
  token: DtcgToken
}

/**
 * We deliberately set $type on every individual token rather than hoisting
 * it to the nearest common group (which the spec allows). Explicit
 * per-token $type is slightly more verbose but immune to a whole class of
 * "why did this token resolve to the wrong type" bugs when groups get
 * reorganized later -- worth the extra bytes.
 */
export function buildDtcgTree(tokens: PlacedToken[]): DtcgDocument {
  const root: DtcgDocument = {}

  for (const { path, token } of tokens) {
    if (path.length === 0) {
      throw new Error("Cannot place a token at an empty path.")
    }

    let cursor: Record<string, unknown> = root
    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i]
      const existing = cursor[segment]

      if (existing && typeof existing === "object" && "$value" in (existing as object)) {
        throw new Error(
          `Naming collision: "${path.slice(0, i + 1).join(".")}" is both a token and a group. Rename one of them in Supernova before exporting.`,
        )
      }

      if (!existing) {
        cursor[segment] = {}
      }
      cursor = cursor[segment] as Record<string, unknown>
    }

    const leafName = path[path.length - 1]
    if (cursor[leafName]) {
      throw new Error(`Duplicate token path "${path.join(".")}" -- two tokens resolved to the same DTCG path.`)
    }
    cursor[leafName] = token
  }

  return root
}
