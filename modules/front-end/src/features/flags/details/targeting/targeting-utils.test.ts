import { describe, expect, it } from "vitest"
import type { FeatureFlag } from "../../flags-types"
import {
  allocationPercentages,
  rolloutFromPercentages,
  stableFlagTargeting,
  targetingOf,
  targetingReviewChanges,
  targetingReviewSegmentIds,
  validateTargeting,
} from "./targeting-utils"

const reviewLabels = { flagOn: "Flag ON", flagOff: "Flag OFF" }
const validationMessages = {
  allocation: "Allocate exactly 100% across variations.",
  conditionRequired: "Add at least one complete condition.",
  conditionIncomplete: "Complete every condition before reviewing changes.",
}

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
  it.each([
    ["aaaaaaaa-1111", "bbbbbbbb-2222", "aaaaaaaa", "bbbbbbbb"],
    ["aaaaaaaa-1111", "aaaaaaaa-2222", "aaaaaaaa-1111", "aaaaaaaa-2222"],
  ])("distinguishes same-name rules with stable unique IDs (%s, %s)", (firstId, secondId, firstLabel, secondLabel) => {
    const previous = flag()
    const rule = previous.rules![0]
    previous.rules = [
      { ...rule, id: firstId, name: "Same name" },
      { ...structuredClone(rule), id: secondId, name: "Same name" },
      { ...structuredClone(rule), id: "unique-rule", name: "Unique name" },
    ]
    const current = structuredClone(previous)
    current.rules = [current.rules![1], current.rules![0], current.rules![2]]
    expect(targetingReviewChanges(previous, current, reviewLabels)).toEqual([
      expect.objectContaining({
        kind: "order",
        previous: `Same name (${firstLabel}) → Same name (${secondLabel}) → Unique name`,
        current: `Same name (${secondLabel}) → Same name (${firstLabel}) → Unique name`,
      }),
    ])
  })

  it("reviews rule reordering and preserves the order in the save payload", () => {
    const previous = flag()
    previous.rules!.push({
      ...structuredClone(previous.rules![0]),
      id: "rule-2",
      name: "Second rule",
    })
    const current = structuredClone(previous)
    current.rules!.reverse()

    expect(targetingReviewChanges(previous, current, reviewLabels)).toEqual([
      {
        kind: "order",
        label: "ruleOrder",
        action: "updated",
        previous: "Enterprise accounts → Second rule",
        current: "Second rule → Enterprise accounts",
      },
    ])
    expect(targetingOf(current).rules.map((rule) => rule.id)).toEqual([
      "rule-2",
      "rule-1",
    ])
    current.rules!.reverse()
    expect(targetingReviewChanges(previous, current, reviewLabels)).toEqual([])
  })

  it("detects reordering alongside additions without treating insertion alone as reordering", () => {
    const previous = flag()
    previous.rules!.push({
      ...structuredClone(previous.rules![0]),
      id: "rule-2",
      name: "Second rule",
    })
    const current = structuredClone(previous)
    current.rules!.unshift({
      ...structuredClone(previous.rules![0]),
      id: "rule-3",
      name: "Third rule",
    })
    expect(
      targetingReviewChanges(previous, current, reviewLabels).map(
        (change) => change.kind
      )
    ).toEqual(["rule"])
    current.rules!.reverse()
    expect(
      targetingReviewChanges(previous, current, reviewLabels).map(
        (change) => change.kind
      )
    ).toEqual(["rule", "order"])
  })

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

  it("includes the OFF variation in dirty and review change detection", () => {
    const previous = flag()
    const current = structuredClone(previous)
    current.disabledVariationId = "new"

    expect(targetingOf(current).disabledVariationId).toBe("new")
    expect(stableFlagTargeting(current)).not.toBe(stableFlagTargeting(previous))
    expect(targetingReviewChanges(previous, current, reviewLabels)).toEqual([
      expect.objectContaining({
        kind: "default",
        label: "Flag OFF",
        action: "updated",
        previous: "Control",
        current: "New checkout",
      }),
    ])
  })

  it("creates semantic review entries for defaults, users, and rules", () => {
    const previous = flag()
    const current = structuredClone(previous)
    current.fallthrough!.variations = [{ id: "new", rollout: [0, 1] }]
    current.targetUsers = [{ variationId: "new", keyIds: ["user-2"] }]
    current.rules![0].conditions[0].value = "professional"
    expect(
      targetingReviewChanges(previous, current, reviewLabels).map(
        (item) => item.kind
      )
    ).toEqual(["default", "targeting", "targeting", "rule"])
  })

  it("keeps added rule conditions in the review model", () => {
    const previous = flag()
    const current = structuredClone(previous)
    current.rules![0].conditions.push({
      id: "condition-2",
      property: "region",
      op: "Equal",
      value: "EU",
    })

    const change = targetingReviewChanges(previous, current, reviewLabels).find(
      (item) => item.kind === "rule"
    )
    expect(change?.previousRule?.conditions).toHaveLength(1)
    expect(change?.currentRule?.conditions).toHaveLength(2)
    expect(change?.previous).toBe("New checkout")
    expect(change?.current).toBe("New checkout")
  })

  it("omits percentages when a rule serves one variation", () => {
    const previous = flag()
    const current = structuredClone(previous)
    current.rules![0].variations = [{ id: "control", rollout: [0, 1] }]

    const change = targetingReviewChanges(previous, current, reviewLabels).find(
      (item) => item.kind === "rule"
    )
    expect(change?.previous).toBe("New checkout")
    expect(change?.current).toBe("Control")
  })

  it("rejects incomplete rules and invalid rollout totals", () => {
    const current = flag()
    current.fallthrough!.variations = [{ id: "control", rollout: [0, 0.5] }]
    current.rules![0].conditions = []
    const errors = validateTargeting(current, validationMessages)
    expect(errors.has("default")).toBe(true)
    expect(errors.has("rule-1")).toBe(true)
  })

  it("validates segment conditions without a normal operator", () => {
    const current = flag()
    current.rules![0].conditions = [
      {
        id: "condition-segment",
        property: "User is in segment",
        op: "",
        value: JSON.stringify(["segment-1"]),
      },
    ]

    expect(validateTargeting(current, validationMessages).has("rule-1")).toBe(
      false
    )

    current.rules![0].conditions[0].value = "[]"
    expect(validateTargeting(current, validationMessages).has("rule-1")).toBe(
      true
    )
  })

  it("collects unique segment ids used by review conditions", () => {
    const previous = flag()
    const current = structuredClone(previous)
    previous.rules![0].conditions = [
      {
        id: "condition-segment",
        property: "User is in segment",
        op: "",
        value: JSON.stringify(["segment-a"]),
      },
    ]
    current.rules![0].conditions = [
      {
        id: "condition-segment",
        property: "User is not in segment",
        op: "",
        value: JSON.stringify(["segment-a", "segment-b"]),
      },
    ]

    expect(
      targetingReviewSegmentIds(
        targetingReviewChanges(previous, current, {
          flagOn: "Flag ON",
          flagOff: "Flag OFF",
        })
      )
    ).toEqual(["segment-a", "segment-b"])
  })
})
