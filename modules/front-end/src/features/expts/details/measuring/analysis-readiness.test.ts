import { describe, expect, it } from "vitest"
import type { ExperimentDetail } from "../experiment-details-types"
import { analysisBlocker } from "./analysis-readiness"
import type { MeasuringRun } from "./measuring-types"

const run: MeasuringRun = {
  id: "run-1",
  slug: "run-1",
  method: "bayesian_ab",
  controlVariant: "control",
  treatmentVariant: "treatment",
  observationStart: "2026-09-01T00:00:00Z",
  primaryMetric: {
    metricId: "metric-1",
    metricKey: "payment-conversion",
    name: "Payment conversion",
    eventName: "purchase",
    metricType: "binary",
    metricAgg: "once",
    expectedDirection: "increase_good",
  },
  decision: null,
  decisionSummary: null,
  decisionReason: null,
  whatChanged: null,
  whatHappened: null,
  confirmedOrRefuted: null,
  whyItHappened: null,
  nextHypothesis: null,
  createdAt: "2026-09-01T00:00:00Z",
}

describe("run metric snapshot readiness", () => {
  it("does not use experiment defaults to fill a missing run snapshot", () => {
    const experiment = {
      flagKey: "checkout",
      primaryMetric: run.primaryMetric,
    } as ExperimentDetail
    expect(analysisBlocker(experiment, { ...run, primaryMetric: null })).toBe(
      "analysisNeedsConfiguration"
    )
  })

  it("allows a complete run snapshot even when experiment defaults are absent", () => {
    const experiment = {
      flagKey: "checkout",
      primaryMetric: null,
    } as ExperimentDetail
    expect(analysisBlocker(experiment, run)).toBeNull()
  })
})
