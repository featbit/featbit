import type { Segment, UserPolicy } from "./segments-types"

export type SegmentAction =
  | "CreateSegment"
  | "ArchiveSegment"
  | "RestoreSegment"
  | "DeleteSegment"
  | "UpdateSegmentName"
  | "UpdateSegmentDescription"
  | "UpdateSegmentTags"
  | "UpdateSegmentTargetingUsers"
  | "UpdateSegmentRules"

function wildcardMatches(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`).test(value)
}

export function environmentRn(input: {
  projectKey: string
  environmentKey: string
}) {
  return `project/${input.projectKey}:env/${input.environmentKey}`
}

export function segmentRn(
  envRn: string,
  segment: Pick<Segment, "key" | "tags">
) {
  const tags = segment.tags?.length ? `;${segment.tags.join(",")}` : ""
  return `${envRn}:segment/${segment.key}${tags}`
}

function resourceMatches(resourceRn: string, pattern: string) {
  if (!resourceRn || !pattern) return false

  const resourceSegments = resourceRn.split(":")
  const patternSegments = pattern.split(":")
  if (patternSegments.length > resourceSegments.length) return false

  return patternSegments.every((patternSegment, index) => {
    const [patternPath, patternTags] = patternSegment.split(";", 2)
    const [resourcePath, resourceTags] = resourceSegments[index].split(";", 2)

    if (!wildcardMatches(patternPath, resourcePath)) return false
    if (patternTags === undefined || patternTags === "") return true
    if (!resourceTags) return false

    const tags = resourceTags.split(",")
    return patternTags
      .split(",")
      .some((patternTag) =>
        tags.some((tag) => wildcardMatches(patternTag, tag))
      )
  })
}

function statementMatches(
  statement: UserPolicy["statements"][number],
  resourceRn: string,
  action: SegmentAction
) {
  if (
    statement.resourceType === "*" ||
    statement.resourceType.toLowerCase() === "all"
  ) {
    return true
  }

  return (
    statement.resourceType === "segment" &&
    (statement.actions.includes(action) ||
      statement.actions.includes("*") ||
      statement.actions.includes("SegmentAllActions")) &&
    statement.resources.some((pattern) => resourceMatches(resourceRn, pattern))
  )
}

function allActionsStatementMatches(
  statement: UserPolicy["statements"][number],
  resourceRn: string
) {
  if (
    statement.resourceType === "*" ||
    statement.resourceType.toLowerCase() === "all"
  ) {
    return true
  }

  return (
    statement.resourceType === "segment" &&
    (statement.actions.includes("*") ||
      statement.actions.includes("SegmentAllActions")) &&
    statement.resources.some((pattern) => resourceMatches(resourceRn, pattern))
  )
}

function allMatchingStatementsAllow(
  statements: UserPolicy["statements"],
  matches: (statement: UserPolicy["statements"][number]) => boolean
) {
  const matching = statements.filter(matches)
  return (
    matching.length > 0 &&
    matching.every((statement) => statement.effect.toLowerCase() === "allow")
  )
}

export function canUseSegmentAction(
  policies: UserPolicy[],
  resourceRn: string,
  action: SegmentAction,
  fineGrainedGranted: boolean
) {
  if (policies.some((policy) => policy.type.toLowerCase() === "owner")) {
    return true
  }

  const statements = policies.flatMap((policy) => policy.statements)
  const actionAllowed = allMatchingStatementsAllow(statements, (statement) =>
    statementMatches(statement, resourceRn, action)
  )

  return Boolean(
    actionAllowed &&
    (fineGrainedGranted ||
      allMatchingStatementsAllow(statements, (statement) =>
        allActionsStatementMatches(statement, resourceRn)
      ))
  )
}
