import { describe, expect, it } from "vitest"
import type { FeatureFlag } from "../../flags-types"
import {
  allocationPercentages,
  rolloutFromPercentages,
  stableFlagTargeting,
  targetingReviewChanges,
  validateTargeting,
} from "./targeting-utils"

function flag(): FeatureFlag {
  return {
    id: "flag-1",
    envId: "env-1",
    revision: "1",
    name: "Checkout redesign",
    key: "checkout-redesign",
    tags: ["checkout"],
    isEnabled: true,
    createdAt: "2026-07-01T10:00:00Z",
    updatedAt: "2026-07-24T14:32:00Z",
    variationType: "boolean",
    variations: [
      { id: "control", name: "Control", value: "false" },
      { id: "new", name: "New checkout", value: "true" },
    ],
    disabledVariationId: "control",
    targetUsers: [{ variationId: "control", keyIds: ["user-1"] }],
    rules: [
      {
        id: "rule-1",
        name: "Enterprise accounts",
        dispatchKey: "keyId",
        conditions: [
          {
            id: "condition-1",
            property: "plan",
            op: "Equal",
            value: "enterprise",
          },
        ],
        variations: [{ id: "new", rollout: [0, 1] }],
      },
    ],
    fallthrough: {
      dispatchKey: "keyId",
      variations: [
        { id: "control", rollout: [0, 0.75] },
        { id: "new", rollout: [0.75, 1] },
      ],
    },
  }
}

describe("feature flag targeting utilities", () => {
  it("round-trips rollout percentages", () => {
    const rollout = rolloutFromPercentages([
      { id: "control", percentage: 75 },
      { id: "new", percentage: 25 },
    ])
    expect(allocationPercentages(rollout)).toEqual([
      { id: "control", percentage: 75 },
      { id: "new", percentage: 25 },
    ])
  })

  it("keeps presentation-only flag fields out of the targeting snapshot", () => {
    const previous = flag()
    const renamed = { ...previous, name: "A renamed flag" }
    expect(stableFlagTargeting(previous)).toBe(stableFlagTargeting(renamed))
  })

  it("creates semantic review entries for defaults, users, and rules", () => {
    const previous = flag()
    const current = structuredClone(previous)
    current.fallthrough!.variations = [{ id: "new", rollout: [0, 1] }]
    current.targetUsers = [{ variationId: "new", keyIds: ["user-2"] }]
    current.rules![0].conditions[0].value = "professional"
    expect(
      targetingReviewChanges(previous, current).map((item) => item.kind)
    ).toEqual(["default", "targeting", "targeting", "rule"])
  })

  it("rejects incomplete rules and invalid rollout totals", () => {
    const current = flag()
    current.fallthrough!.variations = [{ id: "control", rollout: [0, 0.5] }]
    current.rules![0].conditions = []
    const errors = validateTargeting(current)
    expect(errors.has("default")).toBe(true)
    expect(errors.has("rule-1")).toBe(true)
  })
})
