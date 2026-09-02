import { describe, expect, it } from "vitest"
import type { MeasuringRun } from "./measuring-types"
import {
  normalizedMethod,
  orderedRuns,
  parseAnalysis,
  parseAudienceFilters,
  parseExperimentVariantNames,
  parseSamplingPlan,
  runVariants,
  serializeAudienceFilters,
  serializeSamplingPlan,
} from "./measuring-utils"

function run(overrides: Partial<MeasuringRun> = {}): MeasuringRun {
  return {
    id: "run-id",
    slug: "run-1",
    status: "collecting",
    method: "bayesian_ab",
    decision: null,
    decisionSummary: null,
    decisionReason: null,
    whatChanged: null,
    whatHappened: null,
    confirmedOrRefuted: null,
    whyItHappened: null,
    nextHypothesis: null,
    createdAt: "2026-08-30T00:00:00Z",
    ...overrides,
  }
}

describe("measuring utils", () => {
  it("parses Bayesian evidence without inventing missing values", () => {
    const analysis = parseAnalysis(
      JSON.stringify({
        type: "bayesian",
        prior: "flat (improper)",
        srm: { chi2_p_value: 1, ok: true, observed: { easy: 0, hard: 0 } },
        primary_metric: {
          label: "checkout",
          rows: [
            { variant: "easy", n: 0, mean: 0, is_control: true },
            { variant: "hard", n: 0, mean: 0, is_control: false },
          ],
        },
      })
    )

    expect(analysis.type).toBe("bayesian")
    expect(analysis.primary?.rows[1]).toMatchObject({
      variant: "hard",
      n: 0,
      mean: 0,
      relDelta: undefined,
    })
    expect(analysis.srm?.observed).toEqual({ easy: 0, hard: 0 })
  })

  it("merges Bandit recommendations into observed arm rows", () => {
    const analysis = parseAnalysis(
      JSON.stringify({
        type: "bandit",
        metric: "conversion",
        arms: [{ arm: "easy", n: 12, conversions: 3, rate: 0.25 }],
        thompson_sampling: {
          enough_units: true,
          results: [{ arm: "easy", p_best: 0.8, recommended_weight: 0.7 }],
        },
      })
    )

    expect(analysis.primary?.rows[0]).toMatchObject({
      variant: "easy",
      n: 12,
      pBest: 0.8,
      recommendedWeight: 0.7,
    })
  })

  it("keeps stable run order and assignment fallbacks", () => {
    const older = run({
      id: "a",
      controlVariant: "easy",
      treatmentVariant: "normal|hard",
    })
    const newer = run({ id: "b", createdAt: "2026-09-01T00:00:00Z" })

    expect(orderedRuns([newer, older]).map((item) => item.id)).toEqual([
      "a",
      "b",
    ])
    expect(runVariants(older)).toEqual(["easy", "normal", "hard"])
    expect(parseSamplingPlan(older)).toEqual({
      easy: 100,
      normal: 100,
      hard: 100,
    })
    expect(normalizedMethod("bandit")).toBe("bandit")
  })

  it("round-trips sampling roles and audience filters using backend shapes", () => {
    const configured = run({
      controlVariant: "easy-id",
      treatmentVariant: "hard-id",
      analysisSamplingPlan: JSON.stringify([
        { variation: "easy-id", role: "control", includeRate: 80 },
        { variation: "hard-id", role: "treatment", includeRate: 60 },
      ]),
    })

    expect(parseSamplingPlan(configured)).toEqual({
      "easy-id": 80,
      "hard-id": 60,
    })
    expect(
      JSON.parse(
        serializeSamplingPlan(
          "easy-id",
          ["hard-id"],
          { "easy-id": 80, "hard-id": 60 },
          { "easy-id": "Easy", "hard-id": "Hard" }
        )
      )
    ).toEqual([
      { variation: "easy-id", role: "control", includeRate: 80, label: "Easy" },
      {
        variation: "hard-id",
        role: "treatment",
        includeRate: 60,
        label: "Hard",
      },
    ])

    const filters = parseAudienceFilters(
      JSON.stringify([{ property: "country", op: "in", values: ["DE", "FR"] }])
    )
    expect(filters).toEqual([
      { property: "country", op: "in", value: "DE, FR" },
    ])
    expect(JSON.parse(serializeAudienceFilters(filters))).toEqual([
      { property: "country", op: "in", values: ["DE", "FR"] },
    ])
  })

  it("treats empty or invalid audience-filter JSON as no filters", () => {
    expect(parseAudienceFilters("[]")).toEqual([])
    expect(parseAudienceFilters("")).toEqual([])
    expect(parseAudienceFilters(null)).toEqual([])
    expect(parseAudienceFilters("not-json")).toEqual([])
  })

  it("maps experiment variant ids and values to their names", () => {
    expect(
      parseExperimentVariantNames(
        JSON.stringify([
          { key: "normal-id", name: "Normal", value: "normal" },
          { key: "hard-id", name: "Hard", value: "hard" },
        ])
      )
    ).toEqual({
      "normal-id": "Normal",
      Normal: "Normal",
      normal: "Normal",
      "hard-id": "Hard",
      Hard: "Hard",
      hard: "Hard",
    })
    expect(parseExperimentVariantNames("not-json")).toEqual({})
  })
})
