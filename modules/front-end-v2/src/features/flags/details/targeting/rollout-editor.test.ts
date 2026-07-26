import { describe, expect, it } from "vitest"
import { ROLLOUT_MARKER_COLORS } from "./rollout-colors"

describe("rollout variation colors", () => {
  it("provides ten distinct non-neutral colors", () => {
    expect(ROLLOUT_MARKER_COLORS).toHaveLength(10)
    expect(new Set(ROLLOUT_MARKER_COLORS)).toHaveLength(10)
    expect(
      ROLLOUT_MARKER_COLORS.every((color) => color.includes("dark:bg-"))
    ).toBe(true)
    expect(
      ROLLOUT_MARKER_COLORS.every(
        (color) =>
          !color.includes("zinc") &&
          !color.includes("gray") &&
          !color.includes("slate") &&
          !color.includes("neutral") &&
          !color.includes("stone")
      )
    ).toBe(true)
  })
})
