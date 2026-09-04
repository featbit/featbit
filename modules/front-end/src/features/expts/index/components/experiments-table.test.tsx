import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { ExperimentListItem } from "../experiment-types"
import { ExperimentsTable } from "./experiments-table"

const experiment: ExperimentListItem = {
  id: "experiment-1",
  name: "Checkout optimization",
  description: "Reduce friction from cart to completed order",
  stage: "measuring",
  flagKey: "checkout-redesign",
  featBitProjectKey: "ecommerce",
  featBitEnvId: "env-1",
  runCount: 3,
  runMethodSummary: "Bayesian + Bandit arms",
  createdAt: "2026-08-20T08:00:00Z",
  updatedAt: "2026-08-29T08:42:00Z",
}

describe("ExperimentsTable", () => {
  it("shows the approved experiment summary and only a Details action", () => {
    const onFlagFilter = vi.fn()
    render(
      <MemoryRouter>
        <ExperimentsTable
          items={[experiment]}
          loading={false}
          filtered={false}
          lang="en"
          detailsHref={(id) => `/en/experiments/${id}`}
          onFlagFilter={onFlagFilter}
          onClearFilters={vi.fn()}
          onCreate={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Checkout optimization")).toHaveAttribute(
      "href",
      "/en/experiments/experiment-1"
    )
    expect(screen.getByText("3 runs")).toBeInTheDocument()
    expect(screen.getByText("Bayesian A/B/n · Bandit")).toBeInTheDocument()
    expect(screen.getByText("Measuring")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute(
      "href",
      "/en/experiments/experiment-1"
    )
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
    expect(screen.queryByText("Archive")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "checkout-redesign" }))
    expect(onFlagFilter).toHaveBeenCalledWith("checkout-redesign")
  })

  it("shows unbound and no-run states without inventing a method", () => {
    render(
      <MemoryRouter>
        <ExperimentsTable
          items={[
            {
              ...experiment,
              flagKey: null,
              runCount: 0,
              runMethodSummary: null,
              stage: "hypothesis",
            },
          ]}
          loading={false}
          filtered={false}
          lang="en"
          detailsHref={(id) => `/en/experiments/${id}`}
          onFlagFilter={vi.fn()}
          onClearFilters={vi.fn()}
          onCreate={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Not bound")).toBeInTheDocument()
    expect(screen.getByText("No runs")).toBeInTheDocument()
    expect(screen.queryByText("Bayesian A/B/n")).not.toBeInTheDocument()
  })
})
