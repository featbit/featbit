import { act, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n/i18n"
import { FullAnalysis } from "./measuring-details"
import type { MeasuringRun } from "./measuring-types"
import { parseExperimentVariantNames } from "./measuring-utils"

const variantNames = {
  control: "Original",
  candidate: "Guided",
  other: "Compact",
}

function bayesianRun(n: number): MeasuringRun {
  const variants = Object.keys(variantNames)
  return {
    id: "run-id",
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
    createdAt: "2026-09-07T00:00:00Z",
    controlVariant: "control",
    treatmentVariant: "candidate|other",
    analysisResult: JSON.stringify({
      type: "bayesian",
      prior: "flat (improper)",
      srm: {
        chi2_p_value: 1,
        ok: true,
        observed: Object.fromEntries(variants.map((variant) => [variant, n])),
      },
      sample_check: {
        minimum_per_variant: 100,
        ok: n >= 100,
        variants: Object.fromEntries(variants.map((variant) => [variant, n])),
      },
      primary_metric: {
        event: "purchase",
        metric_type: "proportion",
        metric_agg: "once",
        rows: variants.map((variant, index) => ({
          variant,
          n,
          conversions: n / 2,
          rate: n > 0 ? 0.5 : 0,
          is_control: index === 0,
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

function numericRun(): MeasuringRun {
  const run = bayesianRun(200)
  const analysis = JSON.parse(run.analysisResult!)
  analysis.guardrails = [analysis.primary_metric]
  analysis.primary_metric = {
    event: "engagement",
    metric_type: "numeric",
    metric_agg: "count",
    rows: Object.keys(variantNames).map((variant, index) => ({
      variant,
      n: 200,
      is_control: index === 0,
      mean: 3.1227 + index,
    })),
  }
  return { ...run, analysisResult: JSON.stringify(analysis) }
}

describe("Bayesian full analysis", () => {
  it("shows variation names in tables and comparison summaries", () => {
    const variants = [
      {
        key: "1e2bded9-a870-cb37-8e9a-ff93b82edcee",
        name: "control-updated",
        value: "off",
      },
      {
        key: "121efaee-b1ef-5631-9cee-f24137a8e6bc",
        name: "candidate-1-updated",
        value: "guided",
      },
      {
        key: "82da7db8-3a02-9d37-8631-a766bf2dc76a",
        name: "candidate-2-updated",
        value: "compact",
      },
    ]
    const rows = variants.map(({ key }, index) => ({
      variant: key,
      n: 200,
      conversions: 100,
      rate: 0.5,
      is_control: index === 0,
    }))
    const run = {
      ...bayesianRun(200),
      controlVariant: variants[0].key,
      treatmentVariant: variants
        .slice(1)
        .map(({ key }) => key)
        .join("|"),
      analysisResult: JSON.stringify({
        type: "bayesian",
        primary_metric: {
          event: "purchase",
          metric_type: "proportion",
          rows,
          verdict: `${variants[1].key}: strong signal -> adopt treatment; ${variants[2].key}: inconclusive`,
        },
        guardrails: [
          {
            event: "engagement",
            metric_type: "numeric",
            metric_agg: "count",
            rows: rows.map(({ variant, n, is_control }) => ({
              variant,
              n,
              is_control,
              mean: 3,
            })),
            verdict: `${variants[1].key}: guardrail clear; ${variants[2].key}: guardrail ALARM - likely regression`,
          },
        ],
      }),
    }
    render(
      <FullAnalysis
        run={run}
        variantNames={parseExperimentVariantNames(JSON.stringify(variants))}
      />
    )

    expect(
      screen.getByText(
        "candidate-1-updated: strong signal -> adopt treatment; candidate-2-updated: inconclusive"
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "candidate-1-updated: guardrail clear; candidate-2-updated: guardrail ALARM - likely regression"
      )
    ).toBeInTheDocument()
    for (const { key, name } of variants) {
      expect(document.body).not.toHaveTextContent(key)
      for (const table of screen.getAllByRole("table")) {
        expect(within(table).getByText(name)).toBeInTheDocument()
      }
      expect(run.analysisResult).toContain(key)
    }
  })

  it("shows numeric values after swapping the primary and guardrail", () => {
    const { rerender } = render(
      <FullAnalysis run={bayesianRun(200)} variantNames={variantNames} />
    )
    expect(
      within(screen.getAllByRole("table")[0]).getByRole("columnheader", {
        name: "Events",
      })
    ).toBeInTheDocument()

    rerender(<FullAnalysis run={numericRun()} variantNames={variantNames} />)
    const primary = within(screen.getAllByRole("table")[0])
    expect(
      primary.getByRole("columnheader", {
        name: /Events \/ user/,
      })
    ).toBeInTheDocument()
    expect(primary.getByText("3.1227")).toBeInTheDocument()
    expect(
      primary.queryByRole("columnheader", {
        name: "Events",
      })
    ).not.toBeInTheDocument()
    expect(
      within(screen.getAllByRole("table")[1]).getAllByText("50.0%")
    ).toHaveLength(3)

    rerender(
      <FullAnalysis run={bayesianRun(200)} variantNames={variantNames} />
    )
    expect(
      within(screen.getAllByRole("table")[0]).getAllByText("50.0%")
    ).toHaveLength(3)
  })

  it("explains the Bayesian comparison in guardrail value tooltips", async () => {
    render(<FullAnalysis run={bayesianRun(200)} variantNames={variantNames} />)
    act(() =>
      screen.getByRole("button", { name: "About Events / user" }).focus()
    )
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "The Bayesian test compares this per-user average across variants."
    )
  })

  it("shows guardrail evidence with control and treatment labels", () => {
    render(<FullAnalysis run={bayesianRun(200)} variantNames={variantNames} />)
    expect(screen.getAllByRole("table")).toHaveLength(3)
    for (const event of ["engagement", "errors"]) {
      const section = screen
        .getByRole("heading", {
          name: new RegExp(`Guardrail.*${event}`),
        })
        .closest("section")!
      const guardrail = within(section)
      for (const label of [
        "(Control)",
        "(Treatment 1)",
        "(Treatment 2)",
        ...Object.values(variantNames),
      ]) {
        expect(guardrail.getByText(label)).toBeInTheDocument()
      }
    }
    expect(screen.getAllByText("P(harm) 99.0%")).toHaveLength(2)
    expect(screen.getAllByText("P(harm) 0.1%")).toHaveLength(2)
    expect(screen.getByText("Lower is better")).toBeInTheDocument()
    expect(screen.getByText("Passed")).toBeInTheDocument()
  })

  it("keeps guardrails visible without inventing harm probabilities for zero samples", () => {
    render(<FullAnalysis run={bayesianRun(0)} variantNames={variantNames} />)
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
