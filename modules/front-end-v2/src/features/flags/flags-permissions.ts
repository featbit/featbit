import type { FeatureFlag, UserPolicy } from "./flags-types"

export type FlagAction =
  | "CreateFlag"
  | "ToggleFlag"
  | "CopyFlagTo"
  | "CloneFlag"
  | "ArchiveFlag"
  | "RestoreFlag"
  | "DeleteFlag"
  | "UpdateFlagName"
  | "UpdateFlagDescription"
  | "UpdateFlagTags"
  | "UpdateFlagVariations"
  | "UpdateFlagIndividualTargeting"
  | "UpdateFlagTargetingRules"
  | "UpdateFlagDefaultRule"
  | "UpdateFlagOffVariation"

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

export function featureFlagRn(
  envRn: string,
  flag: Pick<FeatureFlag, "key" | "tags">
) {
  const tags = flag.tags?.length ? `;${flag.tags.join(",")}` : ""
  return `${envRn}:flag/${flag.key}${tags}`
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
  action: FlagAction
) {
  if (
    statement.resourceType === "*" ||
    statement.resourceType.toLowerCase() === "all"
  ) {
    return true
  }

  return (
    (statement.actions.includes(action) ||
      statement.actions.includes("*") ||
      statement.actions.includes("FlagAllActions")) &&
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
    (statement.actions.includes("*") ||
      statement.actions.includes("FlagAllActions")) &&
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

export function canUseFlagAction(
  policies: UserPolicy[],
  resourceRn: string,
  action: FlagAction,
  fineGrainedGranted: boolean
) {
  if (policies.some((policy) => policy.type.toLowerCase() === "owner"))
    return true

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
