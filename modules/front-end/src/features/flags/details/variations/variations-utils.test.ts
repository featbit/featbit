import { describe, expect, it } from "vitest"
import type { FeatureFlag } from "../../flags-types"
import {
  stableVariations,
  variationReferences,
  variationReviewChanges,
  variationValueError,
} from "./variations-utils"

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout",
  key: "checkout",
  description: "",
  tags: [],
  isEnabled: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  variationType: "string",
  variations: [
    { id: "control", name: "Control", value: "off" },
    { id: "new", name: "New checkout", value: "on" },
  ],
  disabledVariationId: "control",
  fallthrough: {
    variations: [{ id: "new", rollout: [0, 1] }],
  },
  targetUsers: [{ variationId: "new", keyIds: ["u1"] }],
  rules: [
    {
      id: "rule-1",
      name: "Beta",
      conditions: [],
      variations: [{ id: "new", rollout: [0, 1] }],
    },
  ],
}

describe("variationValueError", () => {
  it("validates immutable typed values", () => {
    expect(variationValueError("number", "1.25")).toBeNull()
    expect(variationValueError("number", "one")).toBe("number")
    expect(variationValueError("json", '{"enabled":true}')).toBeNull()
    expect(variationValueError("json", "true")).toBe("json")
  })
})

describe("variationReferences", () => {
  it("summarizes default, rules, and user references", () => {
    expect(
      variationReferences(flag, "new", {
        defaultOff: "Default OFF",
        defaultOn: "Default ON",
        rules: (count) => `${count} rules`,
        users: (count) => `${count} users`,
      }).labels
    ).toEqual(["Default ON", "1 rules", "1 users"])
  })
})

describe("variation drafts", () => {
  it("trims names when comparing stable payloads", () => {
    expect(stableVariations([{ id: "a", name: " A ", value: "a" }])).toBe(
      stableVariations([{ id: "a", name: "A", value: "a" }])
    )
  })

  it("describes grouped additions and removals alongside updates", () => {
    const changes = variationReviewChanges(
      [
        { id: "a", name: "A", value: "a" },
        { id: "b", name: "B", value: "b" },
      ],
      [
        { id: "b", name: "Beta", value: "b" },
        { id: "c", name: "C", value: "c" },
      ]
    )
    expect(changes).toMatchObject([
      {
        kind: "variations",
        valueGroups: [
          { action: "added", values: ["C"] },
          { action: "removed", values: ["A"] },
        ],
      },
      { action: "updated", label: "Beta" },
    ])
  })

  it.each([
    ["reorder only", ["b", "a", "c"], true],
    ["reorder and add", ["b", "a", "c", "d"], true],
    ["reorder and remove", ["c", "a"], true],
    ["reorder, add, and remove", ["c", "a", "d"], true],
    ["move an added variation", ["d", "a", "b", "c"], true],
    ["append only", ["a", "b", "c", "d"], false],
    ["remove only", ["a", "c"], false],
    ["add and remove without reordering", ["a", "c", "d"], false],
    ["unchanged", ["a", "b", "c"], false],
  ])("detects order changes: %s", (_scenario, ids, reordered) => {
    const variation = (id: string) => ({
      id,
      name: id.toUpperCase(),
      value: id,
    })
    const previous = ["a", "b", "c"].map(variation)
    const current = ids.map(variation)
    const order = variationReviewChanges(previous, current).find(
      (change) => change.label === "order"
    )

    if (reordered) {
      expect(order).toMatchObject({
        action: "updated",
        previous: "A → B → C",
        current: current.map((item) => item.name).join(" → "),
      })
    } else {
      expect(order).toBeUndefined()
    }
  })
})
