import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { Metric } from "../metrics-types"
import { MetricsTable } from "./metrics-table"

const metric: Metric = {
  id: "metric-id",
  envId: "env-id",
  name: "Checkout conversion",
  key: "checkout_completed",
  eventName: "purchase",
  description: "Customers who complete checkout",
  metricType: "binary",
  metricAgg: "once",
  status: "active",
  createdAt: "2026-08-29T00:00:00Z",
  updatedAt: "2026-08-29T00:00:00Z",
  experimentUsage: [
    {
      experimentId: "experiment-id",
      experimentName: "Pricing experiment",
      runs: [
        { id: "run-3", key: "Run 3", role: "primary" },
        { id: "run-2", key: "Run 2", role: "guardrail" },
        { id: "run-1", key: "Run 1", role: "primary" },
      ],
    },
  ],
}

const handlers = {
  onCopy: vi.fn(),
  onEdit: vi.fn(),
  onArchive: vi.fn(),
  onRestore: vi.fn(),
  onClearSearch: vi.fn(),
  onCreate: vi.fn(),
}

describe("MetricsTable", () => {
  it("shows every experiment run and its role without lifecycle labels", () => {
    render(
      <MetricsTable
        items={[metric]}
        loading={false}
        archived={false}
        query=""
        lang="en"
        mutatingId={null}
        {...handlers}
      />,
      { wrapper: MemoryRouter }
    )

    expect(screen.getAllByText("Pricing experiment")).toHaveLength(2)
    expect(
      screen.getByRole("columnheader", { name: "Event name" })
    ).toBeVisible()
    expect(screen.getByText("purchase")).toBeVisible()
    expect(screen.getByText("Primary")).toBeVisible()
    expect(screen.getByText("Guardrail")).toBeVisible()
    const runLink = screen.getByRole("link", { name: "Run 3" })
    expect(runLink).toHaveAttribute(
      "href",
      "/en/experiments/experiment-id?stage=measuring&runId=run-3"
    )
    expect(runLink).toHaveAttribute("target", "_blank")
    expect(screen.queryByText("Running")).not.toBeInTheDocument()
    expect(screen.getByText("Run 2")).toBeVisible()
    expect(screen.queryByText("Completed")).not.toBeInTheDocument()
    expect(screen.queryByText("Run 1")).not.toBeInTheDocument()
    expect(screen.queryByText("Draft")).not.toBeInTheDocument()

    const showMore = screen.getByRole("button", { name: "Show more" })
    expect(showMore).toHaveClass("justify-start", "px-0")
    fireEvent.click(showMore)

    expect(screen.getByRole("link", { name: "Run 1" })).toHaveAttribute(
      "href",
      "/en/experiments/experiment-id?stage=measuring&runId=run-1"
    )
    expect(screen.queryByText("Draft")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show less" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Archive" })).toBeVisible()
  })

  it("shows the empty run state when usage contains no runs", () => {
    render(
      <MetricsTable
        items={[
          {
            ...metric,
            experimentUsage: [
              {
                experimentId: "experiment-without-runs",
                experimentName: "Experiment without runs",
                runs: [],
              },
            ],
          },
        ]}
        loading={false}
        archived={false}
        query=""
        lang="en"
        mutatingId={null}
        {...handlers}
      />,
      { wrapper: MemoryRouter }
    )

    expect(screen.getByText("No experiment runs")).toBeVisible()
    expect(
      screen.queryByText("Experiment without runs")
    ).not.toBeInTheDocument()
  })
})
