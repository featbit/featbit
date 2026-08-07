export type PolicyStatement = {
  id?: string
  resourceType: string
  effect: string
  actions: string[]
  resources: string[]
}

export type Policy = {
  name?: string
  type: string
  statements?: PolicyStatement[]
}

function wildcardMatches(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`).test(value)
}

export function resourceMatches(resourceRn: string, pattern: string) {
  if (!resourceRn || !pattern) return false

  const resourceSegments = resourceRn.split(":")
  const patternSegments = pattern.split(":")
  if (patternSegments.length > resourceSegments.length) return false

  return patternSegments.every((patternSegment, index) => {
    const [patternPath, patternTags] = patternSegment.split(";", 2)
    const [resourcePath, resourceTags] = resourceSegments[index].split(";", 2)

    if (!wildcardMatches(patternPath, resourcePath)) return false
    if (!patternTags) return true
    if (!resourceTags) return false

    const tags = resourceTags.split(",")
    return patternTags
      .split(",")
      .some((patternTag) =>
        tags.some((tag) => wildcardMatches(patternTag, tag))
      )
  })
}

function isAllResourceType(statement: PolicyStatement) {
  return (
    statement.resourceType === "*" ||
    statement.resourceType.toLowerCase() === "all"
  )
}

function actionMatches(statement: PolicyStatement, action: string) {
  return (
    isAllResourceType(statement) ||
    statement.actions.some(
      (statementAction) => statementAction === "*" || statementAction === action
    )
  )
}

function statementMatches(
  statement: PolicyStatement,
  resourceRn: string,
  action: string
) {
  return (
    isAllResourceType(statement) ||
    (actionMatches(statement, action) &&
      statement.resources.some((pattern) =>
        resourceMatches(resourceRn, pattern)
      ))
  )
}

function matchingStatements(
  policies: Policy[],
  matches: (statement: PolicyStatement) => boolean
) {
  return policies.flatMap((policy) => policy.statements ?? []).filter(matches)
}

function everyMatchingStatementAllows(statements: PolicyStatement[]) {
  return (
    statements.length > 0 &&
    statements.every((statement) => statement.effect.toLowerCase() === "allow")
  )
}

export function canUseAction(
  policies: Policy[],
  resourceRn: string,
  action: string
) {
  return everyMatchingStatementAllows(
    matchingStatements(policies, (statement) =>
      statementMatches(statement, resourceRn, action)
    )
  )
}

export function canUseAllActions(policies: Policy[], resourceRn: string) {
  return everyMatchingStatementAllows(
    matchingStatements(
      policies,
      (statement) =>
        isAllResourceType(statement) ||
        (statement.actions.includes("*") &&
          statement.resources.some((pattern) =>
            resourceMatches(resourceRn, pattern)
          ))
    )
  )
}

export function canUseActionOnAnyResource(policies: Policy[], action: string) {
  return everyMatchingStatementAllows(
    matchingStatements(policies, (statement) =>
      actionMatches(statement, action)
    )
  )
}

export function hasOwnerPolicy(policies: Policy[]) {
  return policies.some(
    (policy) =>
      policy.name?.toLowerCase() === "owner" &&
      policy.type.toLowerCase() === "sysmanaged"
  )
}
