import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import "@/lib/i18n/i18n"
import { ExperimentStageNavigation } from "./experiment-stage-navigation"

describe("ExperimentStageNavigation", () => {
  it("renders route-backed stage links and marks the active step", () => {
    render(
      <MemoryRouter>
        <ExperimentStageNavigation
          activeStage="measuring"
          stageHref={(stage) =>
            `/en/experiments/experiment-1?context=environment&stage=${stage}`
          }
        />
      </MemoryRouter>
    )

    expect(screen.getByRole("link", { name: /Measuring/ })).toHaveAttribute(
      "aria-current",
      "step"
    )
    expect(screen.getByRole("link", { name: /Learning/ })).toHaveAttribute(
      "href",
      "/en/experiments/experiment-1?context=environment&stage=learning"
    )
  })
})
