import { describe, expect, it } from "vitest"
import {
  canUseRelayProxies,
  parseAutoAgentStatus,
} from "./relay-proxy-permissions"
import type { UserPolicy } from "./relay-proxy-types"

function policy(
  actions: string[],
  resources = ["relay-proxy/*"],
  effect = "Allow"
): UserPolicy {
  return {
    type: "Custom",
    statements: [
      {
        resourceType: "relay-proxy",
        effect,
        actions,
        resources,
      },
    ],
  }
}

describe("relay proxy permissions", () => {
  it("grants global allow statements list and manage access", () => {
    const policies: UserPolicy[] = [
      {
        type: "SysManaged",
        statements: [
          {
            resourceType: "*",
            effect: "Allow",
            actions: ["*"],
            resources: ["*"],
          },
        ],
      },
    ]
    expect(canUseRelayProxies(policies, "ListRelayProxies")).toBe(true)
    expect(canUseRelayProxies(policies, "ManageRelayProxies")).toBe(true)
  })

  it("requires the requested relay proxy action", () => {
    const policies = [policy(["ListRelayProxies"])]
    expect(canUseRelayProxies(policies, "ListRelayProxies")).toBe(true)
    expect(canUseRelayProxies(policies, "ManageRelayProxies")).toBe(false)
  })

  it("lets a matching deny override an allow", () => {
    const policies = [
      policy(["ListRelayProxies"]),
      policy(["ListRelayProxies"], ["relay-proxy/*"], "Deny"),
    ]

    expect(canUseRelayProxies(policies, "ListRelayProxies")).toBe(false)
  })

  it("ignores deny statements that do not match the requested action", () => {
    const policies = [
      policy(["ListRelayProxies"]),
      policy(["ManageRelayProxies"], ["relay-proxy/*"], "Deny"),
    ]

    expect(canUseRelayProxies(policies, "ListRelayProxies")).toBe(true)
  })

  it("parses automatic agent status without throwing on invalid JSON", () => {
    expect(parseAutoAgentStatus('{"syncState":"Synced"}')).toEqual({
      syncState: "Synced",
    })
    expect(parseAutoAgentStatus("not-json")).toEqual({})
  })
})
