import { describe, expect, it } from "vitest"
import { experimentMethodKeys, experimentStageDot } from "./experiments-utils"

describe("experiment list presentation", () => {
  it("normalizes the supported backend run summaries", () => {
    expect(experimentMethodKeys("Bayesian")).toEqual(["bayesian"])
    expect(experimentMethodKeys("Bandit arms")).toEqual(["bandit"])
    expect(experimentMethodKeys("Bayesian + Bandit arms")).toEqual([
      "bayesian",
      "bandit",
    ])
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
