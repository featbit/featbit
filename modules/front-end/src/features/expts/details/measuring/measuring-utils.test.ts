import { describe, expect, it } from "vitest"
import type { MeasuringRun } from "./measuring-types"
import {
  analysisValueColumn,
  formatAnalysisVerdict,
  normalizedMethod,
  orderedRuns,
  parseAnalysis,
  parseRunVariationNames,
  parseSamplingPlan,
  runVariants,
  serializeSamplingPlan,
} from "./measuring-utils"

function run(overrides: Partial<MeasuringRun> = {}): MeasuringRun {
  return {
    id: "run-id",
    variations: [],
    slug: "run-1",
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
  it("resolves verdict prefixes without rewriting conclusions or unknown variants", () => {
    expect(
      formatAnalysisVerdict(
        "v.2: treatment appears harmful; vX2: inconclusive; treatment: leaning control",
        { "v.2": "Checkout $&", treatment: "Checkout v.2" }
      )
    ).toBe(
      "Checkout $&: treatment appears harmful; vX2: inconclusive; Checkout v.2: leaning control"
    )
    expect(formatAnalysisVerdict("no data", { data: "Another variant" })).toBe(
      "no data"
    )
  })

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

  it.each([
    ["count", "eventsPerUser"],
    ["sum", "valuePerUserSum"],
    ["average", "valuePerUserAverage"],
  ])(
    "preserves a numeric primary with %s aggregation",
    (aggregation, column) => {
      const analysis = parseAnalysis(
        JSON.stringify({
          type: "bayesian",
          primary_metric: {
            event: "engagement",
            metric_type: "numeric",
            metric_agg: aggregation,
            rows: [{ variant: "control", n: 1019, mean: 3182 / 1019 }],
          },
        })
      )
      expect(analysisValueColumn(analysis.primary!)).toBe(column)
      expect(analysis.primary?.rows[0]).toMatchObject({
        mean: 3182 / 1019,
        rate: undefined,
        conversions: undefined,
      })
    }
  )

  it.each([null, "", "invalid", "[]", '{"type":"unknown"}'])(
    "does not interpret invalid or unsupported analysis: %s",
    (value) => {
      expect(parseAnalysis(value)).toEqual({ type: "unknown", guardrails: [] })
    }
  )

  it("keeps stable run order and assignment fallbacks", () => {
    const older = run({
      id: "a",
      controlVariant: "easy",
      treatmentVariants: ["normal", "hard"],
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
    expect(normalizedMethod(" BAYESIAN_AB ")).toBe("bayesian_ab")
    expect(normalizedMethod(null)).toBe("bayesian_ab")
  })

  it("round-trips sampling roles using backend shapes", () => {
    const configured = run({
      controlVariant: "easy-id",
      treatmentVariants: ["hard-id"],
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
  })

  it("maps only run snapshot variation ids to their names", () => {
    expect(
      parseRunVariationNames([
        { id: "normal-id", name: "Normal", value: "normal" },
        { id: "hard-id", name: "Hard", value: "hard" },
      ])
    ).toEqual({
      "normal-id": "Normal",
      "hard-id": "Hard",
    })
    expect(parseRunVariationNames([])).toEqual({})
  })
})
