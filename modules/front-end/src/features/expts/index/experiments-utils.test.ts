import { describe, expect, it } from "vitest"
import { experimentMethodKeys, experimentStageDot } from "./experiments-utils"

describe("experiment list presentation", () => {
  it("normalizes the supported backend run summaries", () => {
    expect(experimentMethodKeys("Bayesian")).toEqual(["bayesian"])
    expect(experimentMethodKeys("BAYESIAN")).toEqual(["bayesian"])
    expect(experimentMethodKeys(null)).toEqual([])
    expect(experimentMethodKeys("No runs")).toEqual([])
    expect(experimentMethodKeys("Frequentist")).toEqual([])
  })

  it("uses a distinct semantic dot for every stage", () => {
    expect(
      new Set([
        experimentStageDot("hypothesis"),
        experimentStageDot("implementing"),
        experimentStageDot("measuring"),
        experimentStageDot("learning"),
      ]).size
    ).toBe(4)
  })
})
