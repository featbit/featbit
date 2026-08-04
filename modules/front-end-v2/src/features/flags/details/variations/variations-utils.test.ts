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
    expect(
      stableVariations([{ id: "a", name: " A ", value: "a" }])
    ).toBe(stableVariations([{ id: "a", name: "A", value: "a" }]))
  })

  it("describes add, update, remove, and reorder changes", () => {
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
    expect(changes.map((change) => change.action)).toEqual([
      "updated",
      "added",
      "removed",
    ])
  })
})
