import { act, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n/i18n"
import { FullAnalysis } from "./measuring-details"
import type { MeasuringRun } from "./measuring-types"
import { parseExperimentVariantNames } from "./measuring-utils"

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
      algorithm: "thompson_sampling_top_two",
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

function numericBanditRun(legacy = false): MeasuringRun {
  const run = banditRun(200)
  const analysis = JSON.parse(run.analysisResult!)
  const binaryArms = analysis.arms as Array<{
    arm: string
    n: number
    conversions: number
    rate: number
  }>
  analysis.guardrails = [
    {
      event: "purchase",
      metric_type: "proportion",
      metric_agg: "once",
      rows: binaryArms.map(({ arm, ...row }) => ({ variant: arm, ...row })),
    },
  ]
  analysis.metric = "engagement"
  if (!legacy) {
    analysis.metric_type = "numeric"
    analysis.metric_agg = "count"
  }
  analysis.arms = binaryArms.map(({ arm, n }, index) => ({
    arm,
    n,
    ...(legacy
      ? { conversions: 0, rate: 3.1227 + index }
      : { mean: 3.1227 + index }),
  }))
  return {
    ...run,
    primaryMetricEvent: "engagement",
    primaryMetricType: "numeric",
    primaryMetricAgg: "count",
    analysisResult: JSON.stringify(analysis),
  }
}

describe("analysis variant names", () => {
  it.each(["bandit", "bayesian_ab"])(
    "shows variation names in %s tables and comparison summaries",
    (method) => {
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
        ...banditRun(200),
        method,
        controlVariant: variants[0].key,
        treatmentVariant: variants
          .slice(1)
          .map(({ key }) => key)
          .join("|"),
        analysisResult: JSON.stringify({
          type: method === "bandit" ? "bandit" : "bayesian",
          metric: "purchase",
          metric_type: "proportion",
          arms: rows.map(({ variant, ...row }) => ({ arm: variant, ...row })),
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
          "candidate-1-updated: guardrail clear; candidate-2-updated: guardrail ALARM - likely regression"
        )
      ).toBeInTheDocument()
      if (method === "bayesian_ab") {
        expect(
          screen.getByText(
            "candidate-1-updated: strong signal -> adopt treatment; candidate-2-updated: inconclusive"
          )
        ).toBeInTheDocument()
      }
      for (const { key, name } of variants) {
        expect(document.body).not.toHaveTextContent(key)
        for (const table of screen.getAllByRole("table")) {
          expect(within(table).getByText(name)).toBeInTheDocument()
        }
        expect(run.analysisResult).toContain(key)
      }
    }
  )
})

describe("Bandit full analysis", () => {
  it.each([false, true])(
    "shows numeric values after swapping the primary and guardrail (legacy=%s)",
    (legacy) => {
      const { rerender } = render(
        <FullAnalysis run={banditRun(200)} variantNames={variantNames} />
      )
      expect(
        within(screen.getAllByRole("table")[0]).getByRole("columnheader", {
          name: "Events",
        })
      ).toBeInTheDocument()
      rerender(
        <FullAnalysis
          run={numericBanditRun(legacy)}
          variantNames={variantNames}
        />
      )
      const primary = within(screen.getAllByRole("table")[0])
      expect(
        primary.getByRole("columnheader", { name: /Events \/ user/ })
      ).toBeInTheDocument()
      expect(primary.getByText("3.1227")).toBeInTheDocument()
      expect(primary.queryByText("312.3%")).not.toBeInTheDocument()
      expect(
        primary.queryByRole("columnheader", { name: "Events" })
      ).not.toBeInTheDocument()
      expect(
        primary.getByRole("columnheader", { name: "Recommended weight" })
      ).toBeInTheDocument()
      expect(
        within(screen.getAllByRole("table")[1]).getAllByText("50.0%")
      ).toHaveLength(3)
      rerender(
        <FullAnalysis run={banditRun(200)} variantNames={variantNames} />
      )
      const restored = within(screen.getAllByRole("table")[0])
      expect(
        restored.getByRole("columnheader", { name: "Events" })
      ).toBeInTheDocument()
      expect(restored.getAllByText("50.0%")).toHaveLength(3)
    }
  )

  it.each(["bandit", "bayesian_ab"] as const)(
    "uses the correct guardrail tooltip for %s",
    async (method) => {
      const run = banditRun(200)
      if (method === "bayesian_ab") {
        const analysis = JSON.parse(run.analysisResult!)
        run.analysisResult = JSON.stringify({
          type: "bayesian",
          primary_metric: {
            event: "purchase",
            metric_type: "proportion",
            metric_agg: "once",
            rows: [
              { variant: "control", n: 200, conversions: 100, rate: 0.5 },
              { variant: "candidate", n: 200, conversions: 120, rate: 0.6 },
            ],
          },
          guardrails: analysis.guardrails,
        })
      }
      render(
        <FullAnalysis run={{ ...run, method }} variantNames={variantNames} />
      )
      act(() =>
        screen.getByRole("button", { name: "About Events / user" }).focus()
      )
      const tooltip = await screen.findByRole("tooltip")
      if (method === "bandit") {
        expect(tooltip).toHaveTextContent(
          "Bandit guardrail check: compare each arm with the baseline."
        )
        expect(tooltip).toHaveTextContent(
          "This check does not change the traffic weights recommended from the primary metric."
        )
      } else {
        expect(tooltip).toHaveTextContent(
          "The Bayesian test compares this per-user average across variants."
        )
        expect(tooltip).not.toHaveTextContent("Thompson Sampling")
      }
    }
  )

  it("explains numeric Bandit primary recommendations in its value tooltip", async () => {
    render(
      <FullAnalysis run={numericBanditRun()} variantNames={variantNames} />
    )
    act(() =>
      screen.getByRole("button", { name: "About Events / user" }).focus()
    )
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "P(best) estimates each arm's chance of having the best primary metric."
    )
  })

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

  it("renders a saved empty binary guardrail as Events/Rate and keeps Bayesian parsing separate", () => {
    const run = banditRun(0)
    const analysis = JSON.parse(run.analysisResult!)
    analysis.metric = "engagement"
    analysis.metric_type = "numeric"
    analysis.metric_agg = "count"
    analysis.arms = analysis.arms.map((row: { arm: string }) => ({
      arm: row.arm,
      n: 0,
      mean: 0,
    }))
    analysis.guardrails = [
      {
        event: "purchase",
        metric_type: "numeric",
        metric_agg: "once",
        inverse: true,
        rows: analysis.arms.map((row: { arm: string }) => ({
          variant: row.arm,
          n: 0,
          mean: 0,
        })),
      },
    ]
    const emptyRun = {
      ...run,
      primaryMetricEvent: "engagement",
      primaryMetricType: "numeric",
      primaryMetricAgg: "count",
      guardrailEvents: JSON.stringify([
        {
          event: "purchase",
          metricType: "binary",
          metricAgg: "once",
          inverse: true,
        },
      ]),
      analysisResult: JSON.stringify(analysis),
    }
    render(<FullAnalysis run={emptyRun} variantNames={variantNames} />)
    const primary = within(screen.getAllByRole("table")[0])
    const guardrail = within(screen.getAllByRole("table")[1])
    expect(
      primary.getByRole("columnheader", { name: /Events \/ user/ })
    ).toBeInTheDocument()
    expect(
      guardrail.getByRole("columnheader", { name: "Events" })
    ).toBeInTheDocument()
    expect(
      guardrail.getByRole("columnheader", { name: /Rate/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("columnheader", { name: /Mean/ })
    ).not.toBeInTheDocument()
    expect(screen.getByText(/need ≥100 users per arm/)).toBeInTheDocument()
    expect(screen.queryByText(/need ≥0 users per arm/)).not.toBeInTheDocument()
    expect(screen.queryByText("<0.1%")).not.toBeInTheDocument()
    expect(screen.queryByText("0%")).not.toBeInTheDocument()
    expect(screen.queryByText("p=1.0000")).not.toBeInTheDocument()
    expect(screen.getByText("Lower is better")).toBeInTheDocument()
  })

  it("does not show legacy recommendation placeholders during burn-in with some samples", () => {
    const run = banditRun(80)
    const analysis = JSON.parse(run.analysisResult!)
    analysis.thompson_sampling.enough_units = false
    analysis.thompson_sampling.minimum_units_per_arm = 100
    render(
      <FullAnalysis
        run={{
          ...run,
          minimumSample: 500,
          analysisResult: JSON.stringify(analysis),
        }}
        variantNames={variantNames}
      />
    )
    const primary = within(screen.getAllByRole("table")[0])
    expect(primary.getAllByText("50.0%")).toHaveLength(3)
    expect(primary.queryByText("33.3%")).not.toBeInTheDocument()
    expect(screen.getByText(/need ≥100 users per arm/)).toBeInTheDocument()
    expect(
      screen.queryByText(/need ≥500 users per arm/)
    ).not.toBeInTheDocument()
  })
})
