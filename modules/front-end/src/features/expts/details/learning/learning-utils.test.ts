import { describe, expect, it } from "vitest"
import type { ExperimentRunDetail } from "../experiment-details-types"
import {
  hasCapturedLearning,
  normalizedDecision,
  orderExperimentRuns,
} from "./learning-utils"

function run(
  values: Partial<ExperimentRunDetail> & Pick<ExperimentRunDetail, "id">
): ExperimentRunDetail {
  return {
    slug: values.id,
    status: "draft",
    method: "bayesian_ab",
    decision: null,
    decisionSummary: null,
    decisionReason: null,
    whatChanged: null,
    whatHappened: null,
    confirmedOrRefuted: null,
    whyItHappened: null,
    nextHypothesis: null,
    createdAt: "2026-08-31T10:00:00Z",
    ...values,
  }
}

describe("learning utils", () => {
  it("orders run labels by stable creation order instead of observation windows", () => {
    expect(
      orderExperimentRuns([
        run({ id: "second", createdAt: "2026-08-31T11:00:00Z" }),
        run({ id: "first", createdAt: "2026-08-31T10:00:00Z" }),
      ]).map((item) => item.id)
    ).toEqual(["first", "second"])
  })

  it("recognizes every structured learning field", () => {
    expect(hasCapturedLearning(run({ id: "empty" }))).toBe(false)
    expect(
      hasCapturedLearning(
        run({ id: "why", whyItHappened: "Fewer transitions reduced exits." })
      )
    ).toBe(true)
  })

  it("normalizes API decision variants for display mapping", () => {
    expect(normalizedDecision("rollback_candidate")).toBe("ROLLBACK CANDIDATE")
  })
})
