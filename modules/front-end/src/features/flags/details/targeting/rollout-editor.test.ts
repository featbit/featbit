import { describe, expect, it } from "vitest"
import {
  VARIATION_MARKER_COLORS,
  variationMarkerColor,
} from "../../variation-colors"

describe("rollout variation colors", () => {
  it("provides ten distinct non-neutral colors", () => {
    expect(VARIATION_MARKER_COLORS).toHaveLength(10)
    expect(new Set(VARIATION_MARKER_COLORS)).toHaveLength(10)
    expect(
      VARIATION_MARKER_COLORS.every((color) => color.includes("dark:bg-"))
    ).toBe(true)
    expect(
      VARIATION_MARKER_COLORS.every(
        (color) =>
          !color.includes("zinc") &&
          !color.includes("gray") &&
          !color.includes("slate") &&
          !color.includes("neutral") &&
          !color.includes("stone")
      )
    ).toBe(true)
    expect(variationMarkerColor(VARIATION_MARKER_COLORS.length)).toBe(
      VARIATION_MARKER_COLORS[0]
    )
  })
})
