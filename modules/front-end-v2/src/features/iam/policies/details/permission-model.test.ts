import { describe, expect, it } from "vitest"
import {
  RESOURCE_PATTERNS,
  actionsForStatement,
  createPolicyStatement,
  initialActionsForResourceType,
  isAllResources,
  resourceDisplayName,
  resolvedResourceDisplayName,
  type PolicyStatement,
} from "./permission-model"

function statement(patch: Partial<PolicyStatement> = {}): PolicyStatement {
  return {
    id: "statement-1",
    resourceType: "project",
    effect: "allow",
    actions: [],
    resources: [RESOURCE_PATTERNS.project],
    ...patch,
  }
}

describe("permission model", () => {
  it("creates a valid all-resources permission", () => {
    const result = createPolicyStatement()
    expect(result).toMatchObject({
      resourceType: "*",
      effect: "allow",
      actions: ["*"],
      resources: ["*"],
    })
  })

  it("recognizes general resource patterns", () => {
    expect(isAllResources(statement())).toBe(true)
    expect(isAllResources(statement({ resources: ["project/checkout"] }))).toBe(
      false
    )
  })

  it("removes non-specific actions for specific resources", () => {
    const allActions = actionsForStatement(statement())
    const specificActions = actionsForStatement(
      statement({ resources: ["project/checkout"] })
    )
    expect(allActions.some((item) => item.name === "CreateProject")).toBe(true)
    expect(specificActions.some((item) => item.name === "CreateProject")).toBe(
      false
    )
  })

  it("derives a compact fallback name from a resource name", () => {
    expect(resourceDisplayName("project/shop:env/production")).toBe(
      "production"
    )
  })

  it("prefers a resolved resource name and falls back when it is blank", () => {
    const rn = "project/shop:env/production"

    expect(resolvedResourceDisplayName(rn, " Production ")).toBe("Production")
    expect(resolvedResourceDisplayName(rn, "   ")).toBe("production")
    expect(resolvedResourceDisplayName("project/", "")).toBe("project/")
  })

  it("defaults fine-grained resource actions to all when unlicensed", () => {
    expect(initialActionsForResourceType("flag", false)).toEqual(["*"])
    expect(initialActionsForResourceType("segment", false)).toEqual(["*"])
    expect(initialActionsForResourceType("flag", true)).toEqual([])
    expect(initialActionsForResourceType("env", false)).toEqual([])
  })
})
