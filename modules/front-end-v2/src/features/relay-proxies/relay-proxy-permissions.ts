import type { UserPolicy } from "./relay-proxy-types"
import { canUseAction } from "@/features/iam/policy-matcher"

export function canUseRelayProxies(
  policies: UserPolicy[],
  action: "ListRelayProxies" | "ManageRelayProxies"
) {
  return canUseAction(policies, "relay-proxy/*", action)
}

export function parseAutoAgentStatus(status: string | object) {
  if (typeof status !== "string") return status
  try {
    return JSON.parse(status) as Record<string, unknown>
  } catch {
    return {}
  }
}
