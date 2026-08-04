import { fetchApi } from "@/lib/api/authenticated-api"

export type CurrentUserPolicyStatement = {
  resourceType: string
  effect: string
  actions: string[]
  resources: string[]
}

export type CurrentUserPolicy = {
  name?: string
  type: string
  statements?: CurrentUserPolicyStatement[]
}

export function fetchCurrentUserPolicies() {
  return fetchApi<CurrentUserPolicy[]>("/api/v1/user/policies")
}

function wildcardMatches(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`).test(value)
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

export function canUseAction(
  policies: CurrentUserPolicy[],
  resourceRn: string,
  action: string
) {
  const matchingStatements = policies
    .flatMap((policy) => policy.statements ?? [])
    .filter((statement) => {
      if (
        statement.resourceType === "*" ||
        statement.resourceType.toLowerCase() === "all"
      ) {
        return true
      }

      return (
        (statement.actions.includes(action) ||
          statement.actions.includes("*")) &&
        statement.resources.some((pattern) =>
          resourceMatches(resourceRn, pattern)
        )
      )
    })

  return (
    matchingStatements.length > 0 &&
    matchingStatements.every(
      (statement) => statement.effect.toLowerCase() === "allow"
    )
  )
}

export function projectRn(projectKey: string) {
  return `project/${projectKey}`
}

export function environmentRn(projectKey: string, environmentKey: string) {
  return `${projectRn(projectKey)}:env/${environmentKey}`
}
