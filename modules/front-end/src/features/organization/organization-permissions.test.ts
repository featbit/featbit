import { describe, expect, it } from "vitest"
import type { OrganizationUserPolicy } from "./organization-api"
import {
  canUseOrganizationAction,
  type OrganizationAction,
} from "./organization-permissions"

function policy(
  action: OrganizationAction | "*",
  effect = "allow",
  resource = "organization/*"
): OrganizationUserPolicy {
  return {
    name: "Custom",
    type: "CustomerManaged",
    statements: [
      {
        resourceType: "organization",
        effect,
        actions: [action],
        resources: [resource],
      },
    ],
  }
}

describe("organization permissions", () => {
  it("keeps each organization action independent", () => {
    const policies = [policy("UpdateOrgName")]

    expect(canUseOrganizationAction(policies, "UpdateOrgName")).toBe(true)
    expect(canUseOrganizationAction(policies, "UpdateOrgSortFlagsBy")).toBe(
      false
    )
    expect(
      canUseOrganizationAction(policies, "UpdateOrgDefaultUserPermissions")
    ).toBe(false)
    expect(canUseOrganizationAction(policies, "CreateOrg")).toBe(false)
  })

  it("supports wildcard actions and resources", () => {
    expect(
      canUseOrganizationAction([policy("*", "allow", "*")], "CreateOrg")
    ).toBe(true)
  })

  it("treats the global resource statement as matching every action", () => {
    const policies: OrganizationUserPolicy[] = [
      {
        name: "Global administrator",
        type: "CustomerManaged",
        statements: [
          {
            resourceType: "*",
            effect: "allow",
            actions: [],
            resources: [],
          },
        ],
      },
    ]

    expect(canUseOrganizationAction(policies, "CreateOrg")).toBe(true)
  })

  it("lets a matching deny override an allow", () => {
    const policies = [policy("UpdateOrgName"), policy("UpdateOrgName", "deny")]

    expect(canUseOrganizationAction(policies, "UpdateOrgName")).toBe(false)
  })

  it("does not grant access from a policy name without matching statements", () => {
    const policies: OrganizationUserPolicy[] = [
      { name: "Owner", type: "SysManaged" },
    ]

    expect(canUseOrganizationAction(policies, "CreateOrg")).toBe(false)
  })
})
