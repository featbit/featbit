import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { Metric } from "../metrics-types"
import { MetricsTable } from "./metrics-table"

const metric: Metric = {
  id: "metric-id",
  featBitEnvId: "env-id",
  name: "Checkout conversion",
  key: "checkout_completed",
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
        { id: "run-3", key: "Run 3", status: "running", role: "primary" },
        { id: "run-2", key: "Run 2", status: "completed", role: "guardrail" },
        { id: "run-1", key: "Run 1", status: "draft", role: "primary" },
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
  it("shows every experiment run, its role, and lifecycle directly", () => {
    render(
      <MetricsTable
        items={[metric]}
        loading={false}
        archived={false}
        query=""
        mutatingId={null}
        {...handlers}
      />
    )

    expect(screen.getAllByText("Pricing experiment")).toHaveLength(2)
    expect(screen.getByText("Primary")).toBeVisible()
    expect(screen.getByText("Guardrail")).toBeVisible()
    expect(screen.getByText("Run 3")).toBeVisible()
    expect(screen.getByText("Running")).toBeVisible()
    expect(screen.getByText("Run 2")).toBeVisible()
    expect(screen.getByText("Completed")).toBeVisible()
    expect(screen.queryByText("Run 1")).not.toBeInTheDocument()
    expect(screen.queryByText("Draft")).not.toBeInTheDocument()

    const showMore = screen.getByRole("button", { name: "Show more" })
    expect(showMore).toHaveClass("justify-start", "px-0")
    fireEvent.click(showMore)

    expect(screen.getByText("Run 1")).toBeVisible()
    expect(screen.getByText("Draft")).toBeVisible()
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
        mutatingId={null}
        {...handlers}
      />
    )

    expect(screen.getByText("No experiment runs")).toBeVisible()
    expect(
      screen.queryByText("Experiment without runs")
    ).not.toBeInTheDocument()
  })
})
