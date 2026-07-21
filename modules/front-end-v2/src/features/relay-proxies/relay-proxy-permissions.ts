import type { UserPolicy } from "./relay-proxy-types"

function wildcardMatches(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`).test(value)
}

export function canUseRelayProxies(
  policies: UserPolicy[],
  action: "ListRelayProxies" | "ManageRelayProxies"
) {
  if (policies.some((policy) => policy.type.toLowerCase() === "owner")) {
    return true
  }

  return policies.some((policy) =>
    policy.statements.some(
      (statement) =>
        statement.effect.toLowerCase() === "allow" &&
        (statement.resourceType === "relay-proxy" ||
          statement.resources.some((resource) =>
            wildcardMatches(resource, "relay-proxy/any")
          )) &&
        (statement.actions.includes(action) ||
          statement.actions.includes("*") ||
          statement.actions.includes("AllRelayProxyActions"))
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
