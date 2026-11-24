import { describe, expect, it } from "vitest"
import { isSemanticVersion, isValidSemVerCondition } from "./semver"
import { conditionValues, withConditionValues } from "./targeting-utils"

describe("semantic versions", () => {
  it.each([
    "1.2",
    "1.2.3",
    "1.2.3-beta.2+build.01",
    "1.2.3-01a",
    "99999999999999999999.0.0",
  ])("accepts %s", (value) => {
    expect(isSemanticVersion(value)).toBe(true)
  })
  it.each([
    "",
    "1",
    "v1.2.3",
    "01.2.3",
    "1.2.3.4",
    "1.2-beta",
    "1.2+build",
    "1.2.3-01",
    "1.2.3-",
    "1.2.3\n",
    " 1.2.3",
    "^1.2.3",
    "1.2.x",
    "1".repeat(257) + ".0.0",
  ])("rejects %s", (value) => {
    expect(isSemanticVersion(value)).toBe(false)
  })
  it("round trips lists and rejects invalid entries and counts", () => {
    const condition = {
      id: "c",
      property: "version",
      op: "SemVerNotOneOf",
      value: "[]",
    }
    const next = withConditionValues(condition, ["1.2", "2.0.0-beta"])
    expect(conditionValues(next)).toEqual(["1.2", "2.0.0-beta"])
    expect(isValidSemVerCondition(next)).toBe(true)
    for (const value of [
      "[]",
      "null",
      "[1]",
      "[null]",
      '["1.2","bad"]',
      "bad",
      JSON.stringify(Array(101).fill("1.2")),
    ]) {
      expect(isValidSemVerCondition({ ...condition, value })).toBe(false)
    }
    expect(
      isValidSemVerCondition({ ...condition, op: "Equal", value: "anything" })
    ).toBe(true)
  })
})
