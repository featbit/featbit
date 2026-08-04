import { describe, expect, it } from "vitest"
import {
  canUseRelayProxies,
  parseAutoAgentStatus,
} from "./relay-proxy-permissions"
import type { UserPolicy } from "./relay-proxy-types"

function policy(actions: string[], resources = ["relay-proxy/*"]): UserPolicy {
  return {
    type: "Custom",
    statements: [
      {
        resourceType: "relay-proxy",
        effect: "Allow",
        actions,
        resources,
      },
    ],
  }
}

describe("relay proxy permissions", () => {
  it("grants owners list and manage access", () => {
    const policies: UserPolicy[] = [{ type: "Owner", statements: [] }]
    expect(canUseRelayProxies(policies, "ListRelayProxies")).toBe(true)
    expect(canUseRelayProxies(policies, "ManageRelayProxies")).toBe(true)
  })

  it("requires the requested relay proxy action", () => {
    const policies = [policy(["ListRelayProxies"])]
    expect(canUseRelayProxies(policies, "ListRelayProxies")).toBe(true)
    expect(canUseRelayProxies(policies, "ManageRelayProxies")).toBe(false)
  })

  it("parses automatic agent status without throwing on invalid JSON", () => {
    expect(parseAutoAgentStatus('{"syncState":"Synced"}')).toEqual({
      syncState: "Synced",
    })
    expect(parseAutoAgentStatus("not-json")).toEqual({})
  })
})
