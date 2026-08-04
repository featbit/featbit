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
        [{ type: "Owner", statements: [] }],
        featureFlagRn(envRn, flag),
        "DeleteFlag"
      )
    ).toBe(true)
  })

  it("matches the canonical all-flags resource used by IAM policies", () => {
    expect(
      canUseFlagAction(
        [policy(["project/*:env/*:flag/*"], ["CopyFlagTo"])],
        featureFlagRn(envRn, flag),
        "CopyFlagTo"
      )
    ).toBe(true)
  })

  it("supports wildcard actions and parent resource scopes", () => {
    expect(
      canUseFlagAction(
        [policy(["project/payments:env/production"], ["*"])],
        featureFlagRn(envRn, flag),
        "CloneFlag"
      )
    ).toBe(true)
  })

  it("matches a policy when any tagged resource pattern matches", () => {
    expect(
      canUseFlagAction(
        [policy([`${envRn}:flag/*;internal,pa*`], ["ArchiveFlag"])],
        featureFlagRn(envRn, flag),
        "ArchiveFlag"
      )
    ).toBe(true)
  })

  it("rejects an action outside the statement resource", () => {
    expect(
      canUseFlagAction(
        [policy(["project/other:env/*:flag/*"], ["CopyFlagTo"])],
        featureFlagRn(envRn, flag),
        "CopyFlagTo"
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
        "CopyFlagTo"
      )
    ).toBe(false)
  })

  it("treats an all-resource deny as a matching statement", () => {
    expect(
      canUseFlagAction(
        [policy([], [], "deny", "*")],
        featureFlagRn(envRn, flag),
        "ToggleFlag"
      )
    ).toBe(false)
  })
})
