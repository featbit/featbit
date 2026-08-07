import { describe, expect, it } from "vitest"
import {
  PERMISSION_CATEGORIES,
  canListAccessTokens,
  canManageAccessTokenType,
  createEmptyPermissionDraft,
  permissionDraftFromStatements,
  permissionDraftToStatements,
  resourcePathLabel,
} from "./access-token-permissions"
import type { PolicyStatement, UserPolicy } from "./access-token-types"

function policyWithStatements(statements: PolicyStatement[]): UserPolicy[] {
  return [{ name: "Custom", type: "CustomerManaged", statements }]
}

function statement(overrides: Partial<PolicyStatement> = {}): PolicyStatement {
  return {
    id: crypto.randomUUID(),
    resourceType: "access-token",
    effect: "allow",
    actions: ["ManagePersonalAccessTokens"],
    resources: ["access-token/*"],
    ...overrides,
  }
}

describe("access token permission model", () => {
  it("grants both token types to the system Owner policy", () => {
    const policies: UserPolicy[] = [
      {
        name: "Owner",
        type: "SysManaged",
        statements: [
          statement({
            resourceType: "*",
            actions: ["*"],
            resources: ["*"],
          }),
        ],
      },
    ]

    expect(canManageAccessTokenType(policies, "Personal")).toBe(true)
    expect(canManageAccessTokenType(policies, "Service")).toBe(true)
  })

  it("does not let the Owner identity bypass a matching deny", () => {
    const policies: UserPolicy[] = [
      {
        name: "Owner",
        type: "SysManaged",
        statements: [
          statement({
            resourceType: "*",
            actions: ["*"],
            resources: ["*"],
          }),
        ],
      },
      {
        name: "Restricted",
        type: "CustomerManaged",
        statements: [statement({ effect: "deny" })],
      },
    ]

    expect(canManageAccessTokenType(policies, "Personal")).toBe(false)
  })

  it("keeps Personal and Service management permissions separate", () => {
    const policies = policyWithStatements([statement()])

    expect(canManageAccessTokenType(policies, "Personal")).toBe(true)
    expect(canManageAccessTokenType(policies, "Service")).toBe(false)
  })

  it("requires ListAccessTokens independently from management permissions", () => {
    const manageOnly = policyWithStatements([statement()])
    expect(canListAccessTokens(manageOnly)).toBe(false)

    const list = statement({ actions: ["ListAccessTokens"] })
    expect(canListAccessTokens(policyWithStatements([list]))).toBe(true)
  })

  it("supports wildcard grants and lets a matching deny win", () => {
    const wildcard = statement({
      resourceType: "*",
      actions: ["*"],
      resources: ["*"],
    })
    expect(
      canManageAccessTokenType(policyWithStatements([wildcard]), "Service")
    ).toBe(true)

    const deny = statement({ effect: "deny" })
    expect(
      canManageAccessTokenType(
        policyWithStatements([statement(), deny]),
        "Personal"
      )
    ).toBe(false)
  })

  it("maps a saved flag wildcard according to the fine-grained license", () => {
    const saved = [
      statement({
        resourceType: "flag",
        actions: ["*"],
        resources: ["project/*:env/*:flag/*"],
      }),
    ]

    const basicDraft = permissionDraftFromStatements(saved, false)
    expect(basicDraft.flag.selectedActions).toEqual(["*"])

    const concreteFlagActions = PERMISSION_CATEGORIES.find(
      (category) => category.type === "flag"
    )!.actions.filter((item) => item.name !== "*")
    const fineGrainedDraft = permissionDraftFromStatements(saved, true)
    expect(fineGrainedDraft.flag.selectedActions).toEqual(
      concreteFlagActions.map((item) => item.name)
    )
    expect(permissionDraftToStatements(fineGrainedDraft)[0].actions).toEqual(
      concreteFlagActions.map((item) => item.name)
    )
  })

  it("preserves saved specific actions after fine-grained access is removed", () => {
    const saved = [
      statement({
        resourceType: "flag",
        actions: ["CreateFlag", "ToggleFlag"],
        resources: ["project/*:env/*:flag/*"],
      }),
    ]

    const draft = permissionDraftFromStatements(saved, false)
    expect(draft.flag.selectedActions).toEqual(["CreateFlag", "ToggleFlag"])
    expect(permissionDraftToStatements(draft)[0]).toMatchObject({
      resourceType: "flag",
      actions: ["CreateFlag", "ToggleFlag"],
    })
  })

  it("serializes every selected Specific resource without collapsing it", () => {
    const draft = createEmptyPermissionDraft()
    draft.segment = {
      selectedActions: ["CreateSegment", "UpdateSegmentRules"],
      scope: "specific",
      specificResources: [
        "project/shop:env/production:segment/beta-users",
        "project/shop:env/staging:segment/early-access",
      ],
    }

    const saved = permissionDraftToStatements(draft)

    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      resourceType: "segment",
      effect: "allow",
      actions: ["CreateSegment", "UpdateSegmentRules"],
      resources: draft.segment.specificResources,
    })
  })

  it("creates compact human-readable resource paths", () => {
    expect(
      resourcePathLabel("project/shop:env/production:segment/beta-users")
    ).toBe("shop / production / beta-users")
  })
})
