import { describe, expect, it } from "vitest"
import type { MemberPermission } from "./permissions-api"
import {
  focusStatementIdForDecision,
  groupMemberPermissionsByPolicy,
  isAllResourceScope,
  isWildcardResource,
  matchesPermissionQuery,
  permissionActionFallback,
} from "./permissions-model"

const permission: MemberPermission = {
  statementId: "statement-1",
  resourceType: "env",
  effect: "allow",
  actions: ["UpdateEnvSettings"],
  resources: ["project/demo:env/production"],
  policyId: "policy-1",
  policyName: "Environment administrators",
  policyType: "CustomerManaged",
  sources: [
    {
      assignmentType: "group",
      groupId: "group-1",
      groupName: "Platform team",
    },
  ],
}

describe("permissions model", () => {
  it("recognizes resource-type wildcard scopes", () => {
    expect(isAllResourceScope("env", ["project/*:env/*"])).toBe(true)
    expect(isAllResourceScope("env", permission.resources)).toBe(false)
  })

  it("recognizes wildcard resources used by access checks", () => {
    expect(isWildcardResource("*")).toBe(true)
    expect(isWildcardResource("workspace/*")).toBe(true)
    expect(isWildcardResource("project/*:env/*")).toBe(true)
    expect(isWildcardResource("project/demo:env/production")).toBe(false)
  })

  it("matches policy, resource, action, source, and localized labels", () => {
    expect(matchesPermissionQuery(permission, "administrators")).toBe(true)
    expect(
      matchesPermissionQuery(permission, "production", ["production"])
    ).toBe(true)
    expect(
      matchesPermissionQuery(permission, "project/demo:env/production", [
        "production",
      ])
    ).toBe(false)
    expect(matchesPermissionQuery(permission, "UpdateEnvSettings")).toBe(true)
    expect(matchesPermissionQuery(permission, "platform team")).toBe(true)
    expect(
      matchesPermissionQuery(permission, "环境设置", ["更新环境设置"])
    ).toBe(true)
    expect(matchesPermissionQuery(permission, "missing")).toBe(false)
  })

  it("falls back to the permission catalog label", () => {
    expect(permissionActionFallback("UpdateEnvSettings")).toBe(
      "Update environment settings"
    )
    expect(permissionActionFallback("UnknownAction")).toBe("UnknownAction")
  })

  it("groups matching statements by policy without duplicating sources", () => {
    const groups = groupMemberPermissionsByPolicy([
      permission,
      {
        ...permission,
        statementId: "statement-2",
        effect: "deny",
        actions: ["DeleteEnv"],
      },
      {
        ...permission,
        statementId: "statement-3",
        policyId: "policy-2",
        policyName: "Environment viewers",
        sources: [{ assignmentType: "direct" }],
      },
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      policyId: "policy-1",
      statementIds: ["statement-1", "statement-2"],
      effects: ["deny", "allow"],
    })
    expect(groups[0].sources).toHaveLength(1)
    expect(groups[1]).toMatchObject({
      policyId: "policy-2",
      statementIds: ["statement-3"],
      effects: ["allow"],
    })

    expect(focusStatementIdForDecision(groups[0], "explicitDeny")).toBe(
      "statement-2"
    )
    expect(focusStatementIdForDecision(groups[0], "allowed")).toBe(
      "statement-1"
    )
  })
})
