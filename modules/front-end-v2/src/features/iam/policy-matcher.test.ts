import { describe, expect, it } from "vitest"
import {
  canUseAction,
  canUseActionOnAnyResource,
  canUseAllActions,
  hasOwnerPolicy,
  resourceMatches,
  type Policy,
  type PolicyStatement,
} from "./policy-matcher"

function statement(overrides: Partial<PolicyStatement> = {}): PolicyStatement {
  return {
    resourceType: "flag",
    effect: "allow",
    actions: ["ToggleFlag"],
    resources: ["project/shop:env/production:flag/*"],
    ...overrides,
  }
}

function policies(...statements: PolicyStatement[]): Policy[] {
  return [{ type: "CustomerManaged", statements }]
}

describe("shared IAM policy matcher", () => {
  it.each([
    ["project/foo", "project/foo", true],
    ["project/foo", "project/bar", false],
    ["project/foo:env/prod", "project/foo", true],
    ["project/foo", "project/foo:env/prod", false],
    ["project/foo-bar", "project/f*-bar", true],
    ["project/foo-baz", "project/f*-bar", false],
    ["project/foo-bar-baz", "project/*-*-*", true],
    ["project/foo;tagA,tagB", "project/foo;tagA", true],
    ["project/foo;tagA", "project/foo;tagB", false],
    ["project/foo;production", "project/foo;prod*", true],
    ["project/foo;staging", "project/foo;prod*", false],
    ["project/foo;tagB", "project/foo;tagA,tagB", true],
    ["project/foo", "project/foo;tagA", false],
    ["project/foo;tagA", "project/foo", true],
    ["project/foo;dev:env/prod;us-east", "project/*;dev:env/*;us-east", true],
    ["project/foo;dev:env/prod;eu-west", "project/*;dev:env/*;us-east", false],
    ["project/foo.bar", "project/*.bar", true],
    ["project/Foo", "project/foo", false],
    ["project/foo:env/prod", "*", true],
    ["", "project/foo", false],
    ["project/foo", "", false],
  ])("keeps RN parity for %s against %s", (resourceRn, pattern, expected) => {
    expect(resourceMatches(resourceRn, pattern)).toBe(expected)
  })

  it("matches hierarchical resources, wildcards, and tags", () => {
    expect(
      resourceMatches(
        "project/shop:env/production:flag/checkout;paid,beta",
        "project/*:env/production"
      )
    ).toBe(true)
    expect(
      resourceMatches(
        "project/shop:env/production:flag/checkout;paid,beta",
        "project/*:env/*:flag/*;internal,be*"
      )
    ).toBe(true)
    expect(
      resourceMatches(
        "project/shop:env/production:flag/checkout;paid,beta",
        "project/other:env/*:flag/*"
      )
    ).toBe(false)
  })

  it("requires a matching allow and gives matching denies precedence", () => {
    const resourceRn = "project/shop:env/production:flag/checkout"
    const allow = statement()
    const deny = statement({
      effect: "deny",
      resources: [resourceRn],
    })

    expect(canUseAction(policies(allow), resourceRn, "ToggleFlag")).toBe(true)
    expect(canUseAction(policies(allow, deny), resourceRn, "ToggleFlag")).toBe(
      false
    )
    expect(canUseAction([], resourceRn, "ToggleFlag")).toBe(false)
  })

  it("treats an all-resource statement like the backend matcher", () => {
    expect(
      canUseAction(
        policies(
          statement({
            resourceType: "*",
            actions: [],
            resources: [],
          })
        ),
        "organization/*",
        "CreateOrg"
      )
    ).toBe(true)
  })

  it("uses action and RN rather than trusting resourceType metadata", () => {
    expect(
      canUseAction(
        policies(
          statement({
            resourceType: "segment",
            actions: ["CreateOrg"],
            resources: ["organization/*"],
          })
        ),
        "organization/*",
        "CreateOrg"
      )
    ).toBe(true)
  })

  it("distinguishes all-actions grants from concrete actions", () => {
    const resourceRn = "project/shop:env/production:flag/checkout"

    expect(canUseAllActions(policies(statement()), resourceRn)).toBe(false)
    expect(
      canUseAllActions(policies(statement({ actions: ["*"] })), resourceRn)
    ).toBe(true)
  })

  it("checks action availability without duplicating feature matchers", () => {
    expect(canUseActionOnAnyResource(policies(statement()), "ToggleFlag")).toBe(
      true
    )
    expect(
      canUseActionOnAnyResource(
        policies(statement(), statement({ effect: "deny" })),
        "ToggleFlag"
      )
    ).toBe(false)
  })

  it("recognizes only the system-managed Owner policy", () => {
    expect(
      hasOwnerPolicy([{ name: "Owner", type: "SysManaged", statements: [] }])
    ).toBe(true)
    expect(
      hasOwnerPolicy([
        { name: "Owner", type: "CustomerManaged", statements: [] },
      ])
    ).toBe(false)
  })
})
