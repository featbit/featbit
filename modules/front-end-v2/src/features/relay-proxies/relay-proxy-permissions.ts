import type { UserPolicy } from "./relay-proxy-types"

function wildcardMatches(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`).test(value)
}

export function canUseRelayProxies(
  policies: UserPolicy[],
  action: "ListRelayProxies" | "ManageRelayProxies"
) {
  const matchingStatements = policies
    .flatMap((policy) => policy.statements)
    .filter(
      (statement) =>
        statement.resourceType === "*" ||
        ((statement.actions.includes(action) ||
          statement.actions.includes("*")) &&
          statement.resources.some((resource) =>
            wildcardMatches(resource, "relay-proxy/*")
          ))
    )

  return (
    matchingStatements.length > 0 &&
    matchingStatements.every(
      (statement) => statement.effect.toLowerCase() === "allow"
    )
  )
}

export function parseAutoAgentStatus(status: string | object) {
  if (typeof status !== "string") return status
  try {
    return JSON.parse(status) as Record<string, unknown>
  } catch {
    return {}
  }
}
