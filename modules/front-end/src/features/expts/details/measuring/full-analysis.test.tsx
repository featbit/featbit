import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n/i18n"
import { FullAnalysis } from "./measuring-details"
import type { MeasuringRun } from "./measuring-types"

function banditRun(n: number): MeasuringRun {
  const variants = ["control", "candidate", "other"]
  return {
    id: "run-id",
    slug: "run-1",
    method: "bandit",
    decision: null,
    decisionSummary: null,
    decisionReason: null,
    whatChanged: null,
    whatHappened: null,
    confirmedOrRefuted: null,
    whyItHappened: null,
    nextHypothesis: null,
    createdAt: "2026-09-07T00:00:00Z",
    controlVariant: "control",
    treatmentVariant: "candidate|other",
    analysisResult: JSON.stringify({
      type: "bandit",
      metric: "purchase",
      srm: {
        chi2_p_value: 1,
        ok: true,
        observed: Object.fromEntries(variants.map((variant) => [variant, n])),
      },
      arms: variants.map((arm) => ({ arm, n, conversions: n / 2, rate: 0.5 })),
      thompson_sampling: {
        enough_units: n > 0,
        results: variants.map((arm) => ({
          arm,
          p_best: 1 / 3,
          recommended_weight: 1 / 3,
        })),
      },
      guardrails: [
        {
          event: "engagement",
          metric_type: "numeric",
          metric_agg: "count",
          rows: variants.map((variant, index) => ({
            variant,
            n,
            mean: n === 0 ? 0 : 10,
            is_control: index === 0,
            ...(n > 0 && index > 0
              ? {
                  rel_delta: -0.1,
                  ci_lower: -0.2,
                  ci_upper: -0.05,
                  p_harm: 0.99,
                }
              : {}),
          })),
        },
        {
          event: "errors",
          metric_type: "proportion",
          metric_agg: "once",
          inverse: true,
          rows: variants.map((variant, index) => ({
            variant,
            n,
            conversions: n / 10,
            rate: n === 0 ? 0 : 0.1,
            is_control: index === 0,
            ...(n > 0 && index > 0 ? { p_harm: 0.001 } : {}),
          })),
        },
      ],
    }),
  }
}

const variantNames = {
  control: "Original",
  candidate: "Guided",
  other: "Compact",
}

describe("Bandit full analysis", () => {
  it("shows guardrail evidence for every arm with baseline and arm labels", () => {
    render(<FullAnalysis run={banditRun(200)} variantNames={variantNames} />)

    expect(screen.getAllByRole("table")).toHaveLength(3)
    for (const event of ["engagement", "errors"]) {
      const section = screen
        .getByRole("heading", {
          name: new RegExp(`Guardrail.*${event}`),
        })
        .closest("section")!
      const guardrail = within(section)
      expect(guardrail.getByText("(Baseline)")).toBeInTheDocument()
      expect(guardrail.getAllByText("(Arm)")).toHaveLength(2)
      expect(guardrail.getByText("Original")).toBeInTheDocument()
      expect(guardrail.getByText("Guided")).toBeInTheDocument()
      expect(guardrail.getByText("Compact")).toBeInTheDocument()
      expect(
        guardrail.queryByText("Recommended weight")
      ).not.toBeInTheDocument()
    }
    expect(screen.getAllByText("P(harm) 99.0%")).toHaveLength(2)
    expect(screen.getAllByText("P(harm) 0.1%")).toHaveLength(2)
    expect(screen.getByText("Lower is better")).toBeInTheDocument()
  })

  it("keeps guardrails visible without inventing harm probabilities for zero samples", () => {
    render(<FullAnalysis run={banditRun(0)} variantNames={variantNames} />)

    expect(screen.getByText("No evaluable data")).toBeInTheDocument()
    expect(screen.getAllByRole("table")).toHaveLength(3)
    expect(
      screen.getByRole("heading", { name: /Guardrail.*engagement/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /Guardrail.*errors/ })
    ).toBeInTheDocument()
    expect(screen.queryByText(/P\(harm\) \d/)).not.toBeInTheDocument()
  })
})
