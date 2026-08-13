import { describe, expect, it } from "vitest"
import {
  canUseFlagAction,
  environmentRn,
  featureFlagRn,
} from "./flags-permissions"
import type { FeatureFlag, UserPolicy } from "./flags-types"

const envRn = environmentRn({
  projectKey: "payments",
  environmentKey: "production",
})

const flag: Pick<FeatureFlag, "key" | "tags"> = {
  key: "new-checkout",
  tags: ["paid", "beta"],
}

function policy(
  resources: string[],
  actions: string[],
  effect = "allow",
  resourceType = "flag"
): UserPolicy {
  return {
    type: "Custom",
    statements: [{ resourceType, effect, resources, actions }],
  }
}

describe("feature flag permissions", () => {
  it("builds canonical environment and tagged flag resource names", () => {
    expect(envRn).toBe("project/payments:env/production")
    expect(featureFlagRn(envRn, flag)).toBe(
      `${envRn}:flag/new-checkout;paid,beta`
    )
  })

  it("grants owners every flag action", () => {
    expect(
      canUseFlagAction(
        [
          {
            name: "Owner",
            type: "SysManaged",
            statements: [
              {
                resourceType: "*",
                effect: "allow",
                resources: ["*"],
                actions: ["*"],
              },
            ],
          },
        ],
        featureFlagRn(envRn, flag),
        "DeleteFlag",
        false
      )
    ).toBe(true)
  })

  it("does not let Owner bypass a matching deny", () => {
    expect(
      canUseFlagAction(
        [
          {
            name: "Owner",
            type: "SysManaged",
            statements: [
              {
                resourceType: "*",
                effect: "allow",
                resources: ["*"],
                actions: ["*"],
              },
            ],
          },
          policy([`${envRn}:flag/*`], ["DeleteFlag"], "deny"),
        ],
        featureFlagRn(envRn, flag),
        "DeleteFlag",
        false
      )
    ).toBe(false)
  })

  it("matches the canonical all-flags resource used by IAM policies", () => {
    expect(
      canUseFlagAction(
        [policy(["project/*:env/*:flag/*"], ["CopyFlagTo"])],
        featureFlagRn(envRn, flag),
        "CopyFlagTo",
        true
      )
    ).toBe(true)
  })

  it("uses the backend targeting-rules action name", () => {
    expect(
      canUseFlagAction(
        [policy(["project/*:env/*:flag/*"], ["UpdateFlagTargetingRules"])],
        featureFlagRn(envRn, flag),
        "UpdateFlagTargetingRules",
        true
      )
    ).toBe(true)
  })

  it("supports wildcard actions and parent resource scopes", () => {
    expect(
      canUseFlagAction(
        [policy(["project/payments:env/production"], ["*"])],
        featureFlagRn(envRn, flag),
        "CloneFlag",
        false
      )
    ).toBe(true)
  })

  it("matches a policy when any tagged resource pattern matches", () => {
    expect(
      canUseFlagAction(
        [policy([`${envRn}:flag/*;internal,pa*`], ["ArchiveFlag"])],
        featureFlagRn(envRn, flag),
        "ArchiveFlag",
        true
      )
    ).toBe(true)
  })

  it("rejects an action outside the statement resource", () => {
    expect(
      canUseFlagAction(
        [policy(["project/other:env/*:flag/*"], ["CopyFlagTo"])],
        featureFlagRn(envRn, flag),
        "CopyFlagTo",
        true
      )
    ).toBe(false)
  })

  it("gives matching deny statements precedence over allows", () => {
    expect(
      canUseFlagAction(
        [
          policy(["project/*:env/*:flag/*"], ["CopyFlagTo"]),
          policy([`${envRn}:flag/new-checkout`], ["CopyFlagTo"], "deny"),
        ],
        featureFlagRn(envRn, flag),
        "CopyFlagTo",
        true
      )
    ).toBe(false)
  })

  it("treats an all-resource deny as a matching statement", () => {
    expect(
      canUseFlagAction(
        [policy([], [], "deny", "*")],
        featureFlagRn(envRn, flag),
        "ToggleFlag",
        true
      )
    ).toBe(false)
  })

  it("requires fine-grained access for a concrete action policy", () => {
    expect(
      canUseFlagAction(
        [policy([`${envRn}:flag/*`], ["ToggleFlag"])],
        featureFlagRn(envRn, flag),
        "ToggleFlag",
        false
      )
    ).toBe(false)
  })

  it("allows an all-actions policy without fine-grained access", () => {
    expect(
      canUseFlagAction(
        [policy([`${envRn}:flag/*`], ["*"])],
        featureFlagRn(envRn, flag),
        "ToggleFlag",
        false
      )
    ).toBe(true)
  })
})
