import { beforeEach, describe, expect, it } from "vitest"
import {
  getAuthenticatedLandingPath,
  markGetStartedVisited,
} from "./get-started-state"

describe("get started state", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("routes first-time users to get started", () => {
    expect(getAuthenticatedLandingPath()).toBe("/get-started")
  })

  it("routes returning users to feature flags", () => {
    markGetStartedVisited()

    expect(localStorage.getItem("get-started")).toBe("true")
    expect(getAuthenticatedLandingPath()).toBe("/feature-flags")
  })
})
