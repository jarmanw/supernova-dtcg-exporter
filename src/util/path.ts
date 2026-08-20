/**
 * Turns a Supernova token's group ancestry + own name into a DTCG group
 * path, e.g. ["color", "ui-elements", "primary"].
 *
 * VERIFY against the live SDK: this assumes `TokenGroup` has `id`,
 * `parentId` (nullable/undefined at the top), `name`, and `isRoot`
 * (confirmed from the SDK basics doc: `allGroups.find(g => g.isRoot &&
 * g.tokenType === TokenType.color)`). The synthetic per-type root group is
 * excluded from the path -- it's structural, not something anyone named.
 */
export type MinimalGroup = {
  id: string
  parentId?: string | null
  name: string
  isRoot?: boolean
}

/** Characters the DTCG spec forbids in token/group names: `{ } .` */
export function sanitizeSegment(name: string): string {
  return name.replace(/[{}.]/g, "-")
}

export function buildGroupAncestryPath(groupId: string, groupsById: Map<string, MinimalGroup>): string[] {
  const segments: string[] = []
  let current = groupsById.get(groupId)
  const seen = new Set<string>()

  while (current) {
    if (seen.has(current.id)) {
      throw new Error(`Circular token group ancestry detected at group "${current.id}".`)
    }
    seen.add(current.id)

    if (!current.isRoot) {
      segments.unshift(sanitizeSegment(current.name))
    }

    current = current.parentId ? groupsById.get(current.parentId) : undefined
  }

  return segments
}

export function buildTokenPath(tokenName: string, groupId: string, groupsById: Map<string, MinimalGroup>): string[] {
  return [...buildGroupAncestryPath(groupId, groupsById), sanitizeSegment(tokenName)]
}

/**
 * Preferred path resolution: `Token.tokenPath` (confirmed real, from
 * SDKToken.d.ts) is the group-ancestry breadcrumb -- it does NOT include
 * the token's own name, so that must be appended. Falls back to walking
 * `parentGroupId` through the group map on the rarer case `tokenPath` is
 * null (still using the group-ancestry walker above, whose field names
 * are unverified against the real `TokenGroup` type).
 */
export function resolveTokenPath(
  token: { name: string; tokenPath: string[] | null; parentGroupId: string },
  groupsById: Map<string, MinimalGroup>,
): string[] {
  const ancestry = token.tokenPath && token.tokenPath.length > 0 ? token.tokenPath.map(sanitizeSegment) : buildGroupAncestryPath(token.parentGroupId, groupsById)
  return [...ancestry, sanitizeSegment(token.name)]
}

export function pathToAliasReference(path: string[]): string {
  return `{${path.join(".")}}`
}