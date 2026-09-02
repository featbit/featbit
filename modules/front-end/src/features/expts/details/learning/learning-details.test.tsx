import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type {
  ExperimentDetail,
  ExperimentRunDetail,
} from "../experiment-details-types"
import { LearningDetails } from "./learning-details"

function run(
  values: Partial<ExperimentRunDetail> & Pick<ExperimentRunDetail, "id">
): ExperimentRunDetail {
  return {
    slug: values.id,
    status: "decided",
    method: "bayesian_ab",
    decision: "CONTINUE",
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

function experiment(runs: ExperimentRunDetail[]): ExperimentDetail {
  return {
    id: "experiment-1",
    name: "Checkout optimization",
    description: "Reduce friction from cart to completed order",
    stage: "learning",
    flagKey: "checkout-redesign",
    featBitProjectKey: "ecommerce",
    featBitEnvId: "env-1",
    runCount: runs.length,
    hypothesis: "A shorter checkout will improve conversion.",
    goal: "Improve conversion",
    intent: "Reduce checkout friction",
    change: "Use one page",
    constraints: null,
    conflictAnalysis: null,
    lastLearning: "The shorter flow improved conversion.",
    primaryMetric: null,
    guardrails: null,
    experimentRuns: runs,
    createdAt: "2026-08-30T10:00:00Z",
    updatedAt: "2026-08-31T10:00:00Z",
  }
}

describe("LearningDetails", () => {
  it("shows experiment learning and switches between stable run tabs", async () => {
    await act(async () => {
      render(
        <LearningDetails
          experiment={experiment([
            run({
              id: "run-1",
              slug: "checkout-v2-run-1",
              whatChanged: "Changed the checkout layout.",
            }),
            run({
              id: "run-2",
              slug: "checkout-v2-run-2",
              createdAt: "2026-08-31T11:00:00Z",
              method: "bandit",
              decision: "INCONCLUSIVE",
              whatHappened: "The sample was too small.",
            }),
          ])}
          saving={false}
          saveError={false}
          onSave={vi.fn()}
        />
      )
    })

    expect(screen.getByText("Outcome & learning")).toBeInTheDocument()
    expect(
      screen.getByText("The shorter flow improved conversion.")
    ).toBeInTheDocument()
    expect(screen.getByText("checkout-v2-run-2")).toBeInTheDocument()
    expect(screen.getByText("The sample was too small.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: /Run 1/ }))

    expect(screen.getByText("checkout-v2-run-1")).toBeInTheDocument()
    expect(screen.getByText("Changed the checkout layout.")).toBeInTheDocument()
  })

  it("keeps runs visible when their learning has not been captured", async () => {
    await act(async () => {
      render(
        <LearningDetails
          experiment={experiment([run({ id: "run-without-learning" })])}
          saving={false}
          saveError={false}
          onSave={vi.fn()}
        />
      )
    })

    expect(screen.getByText("run-without-learning")).toBeInTheDocument()
    expect(
      screen.getByText("No learning captured for this run.")
    ).toBeInTheDocument()
  })

  it("renders narrative learning fields as full-width divided rows", async () => {
    await act(async () => {
      render(
        <LearningDetails
          experiment={experiment([
            run({
              id: "run-with-five-fields",
              whatChanged: "Changed",
              whatHappened: "Observed",
              confirmedOrRefuted: "Confirmed",
              whyItHappened: "Because",
              nextHypothesis: "Try the next iteration",
            }),
          ])}
          saving={false}
          saveError={false}
          onSave={vi.fn()}
        />
      )
    })

    const nextHypothesisRow = screen.getByText("Next hypothesis").parentElement
    expect(nextHypothesisRow).toHaveClass("grid-cols-[180px_minmax(0,1fr)]")
    expect(nextHypothesisRow?.parentElement).toHaveClass("divide-y")
  })

  it("shows the no-run state without fabricating learning rows", async () => {
    await act(async () => {
      render(
        <LearningDetails
          experiment={experiment([])}
          saving={false}
          saveError={false}
          onSave={vi.fn()}
        />
      )
    })

    expect(screen.getByText("No experiment runs yet.")).toBeInTheDocument()
    expect(screen.queryByText("What changed")).not.toBeInTheDocument()
  })
})
