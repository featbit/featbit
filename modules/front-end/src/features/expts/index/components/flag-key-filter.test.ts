import { describe, expect, it } from "vitest"
import { matchesFlagKey } from "./flag-key-filter-utils"

describe("matchesFlagKey", () => {
  it("matches only against the feature flag key", () => {
    const flag = { key: "checkout-redesign" }

    expect(matchesFlagKey(flag, "REDESIGN")).toBe(true)
    expect(matchesFlagKey(flag, " checkout ")).toBe(true)
    expect(matchesFlagKey(flag, "recommendation")).toBe(false)
  })
})
