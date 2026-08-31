import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { ExperimentDetail } from "../experiment-details-types"
import { ExperimentDetailsHeader } from "./experiment-details-header"

const run = (id: string) => ({
  id,
  slug: id,
  status: "archived",
  method: "bandit",
  decision: "INCONCLUSIVE",
  decisionSummary: null,
  decisionReason: null,
  whatChanged: null,
  whatHappened: null,
  confirmedOrRefuted: null,
  whyItHappened: null,
  nextHypothesis: null,
  createdAt: "2026-08-31T10:00:00Z",
})

const experiment: ExperimentDetail = {
  id: "experiment-1",
  name: "Checkout experiment",
  description: "Test checkout changes",
  stage: "learning",
  flagKey: "checkout-flow",
  featBitProjectKey: "project-1",
  featBitEnvId: "environment-1",
  runCount: 0,
  hypothesis: null,
  goal: null,
  intent: null,
  change: null,
  constraints: null,
  conflictAnalysis: null,
  lastLearning: null,
  primaryMetric: null,
  guardrails: null,
  experimentRuns: [run("run-1"), run("run-2")],
  createdAt: "2026-08-29T10:00:00Z",
  updatedAt: "2026-08-31T10:00:00Z",
}

describe("ExperimentDetailsHeader", () => {
  it("uses the list stage color and the real detail run collection", () => {
    render(
      <MemoryRouter>
        <ExperimentDetailsHeader
          experiment={experiment}
          lang="en"
          settingsActive={false}
          onAgentSetup={vi.fn()}
          onSettings={vi.fn()}
        />
      </MemoryRouter>
    )

    const stageBadge = screen.getByText("Learning")
    expect(stageBadge.querySelector("span")).toHaveClass("bg-amber-500")
    expect(screen.getByText("2 runs")).toBeInTheDocument()
    expect(screen.queryByText("No runs")).not.toBeInTheDocument()

    const description = screen.getByText("Test checkout changes")
    const headerDetails =
      screen.getByRole("heading").parentElement?.parentElement
    expect(headerDetails?.lastElementChild).toBe(description)
  })
})
