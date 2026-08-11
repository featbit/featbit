import { describe, expect, it } from "vitest"
import type { AuditInstruction, Segment } from "../segments-types"
import {
  auditEventKind,
  auditFragments,
  conditionValues,
  normalizedRules,
  settingsChanges,
  settingsReviewChanges,
  targetingChanges,
} from "./segment-details-utils"

const segment: Segment = {
  id: "segment-1",
  name: "Enterprise",
  key: "enterprise",
  type: "environment-specific",
  scopes: [],
  tags: ["paid"],
  description: "Paid customers",
  updatedAt: "2026-07-23T10:00:00Z",
  isArchived: false,
  included: ["user-1"],
  excluded: [],
  rules: [
    {
      id: "rule-1",
      name: "Plan",
      conditions: [
        {
          id: "condition-1",
          property: "plan",
          op: "IsOneOf",
          value: '["pro","enterprise"]',
        },
      ],
    },
  ],
}

describe("segment details utilities", () => {
  it("parses multi-value conditions and drops empty rules before saving", () => {
    expect(conditionValues(segment.rules[0].conditions[0])).toEqual([
      "pro",
      "enterprise",
    ])
    expect(
      normalizedRules([
        ...segment.rules,
        { id: "empty", name: "Empty", conditions: [] },
      ])
    ).toHaveLength(1)
  })

  it("creates deterministic targeting and settings review changes", () => {
    const current = structuredClone(segment)
    current.included.push("user-2")
    current.rules[0].name = "Account plan"
    current.name = "Enterprise accounts"
    current.tags = ["paid", "priority"]

    expect(
      targetingChanges(segment, current).map((item) => item.label)
    ).toEqual(["includedUsers", "Account plan"])
    expect(targetingChanges(segment, current)[0]).toMatchObject({
      action: "added",
      affectedCount: 1,
      values: ["user-2"],
    })
    expect(settingsChanges(segment, current).map((item) => item.field)).toEqual(
      ["name", "tags"]
    )
    expect(settingsReviewChanges(segment, current)).toHaveLength(2)
    expect(settingsReviewChanges(segment, current)[1]).toMatchObject({
      kind: "tags",
      valueGroups: [{ action: "added", values: ["priority"] }],
    })
    expect(settingsReviewChanges(segment, current)[1]).not.toHaveProperty(
      "action"
    )
    expect(targetingChanges(segment, current)[1]).toMatchObject({
      kind: "rule",
      previousRule: { name: "Plan" },
      currentRule: { name: "Account plan" },
    })
  })

  it("classifies audit updates and counts affected domain values", () => {
    const instructions: AuditInstruction[] = [
      {
        kind: "AddTargetUsersToIncluded",
        value: ["one", "two", "three"],
      },
      { kind: "UpdateRuleCondition", value: { ruleId: "rule-1" } },
    ]
    expect(auditEventKind(instructions)).toBe("targeting")
    expect(auditFragments(instructions)).toEqual([
      { kind: "AddTargetUsersToIncluded", count: 3 },
      { kind: "UpdateRuleCondition", count: 1 },
    ])
  })

  it("falls back to a generic update for mixed instruction categories", () => {
    expect(
      auditEventKind([
        { kind: "UpdateName", value: "New name" },
        { kind: "AddRule", value: {} },
      ])
    ).toBe("segment")
  })
})
