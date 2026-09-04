import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { Metric } from "../metrics-types"
import { MetricSheet } from "./metric-sheet"

const metric: Metric = {
  id: "metric-id",
  featBitEnvId: "env-id",
  name: "Checkout conversion",
  key: "checkout_completed",
  description: "Completed checkout",
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
        {
          id: "run-id",
          key: "run-1",
          status: "completed",
          role: "primary",
        },
      ],
    },
  ],
}

function renderSheet(currentMetric: Metric | null, onSubmit = vi.fn()) {
  const result = render(
    <MetricSheet
      metric={currentMetric}
      saving={false}
      onOpenChange={vi.fn()}
      onSubmit={onSubmit}
    />
  )
  return { ...result, onSubmit }
}

describe("MetricSheet", () => {
  it("allows the key during creation and normalizes it from the name", async () => {
    renderSheet(null)

    const nameInput = screen.getByLabelText("Name *")
    const keyInput = screen.getByLabelText("Key *")
    expect(keyInput).not.toHaveAttribute("readonly")

    fireEvent.change(nameInput, { target: { value: "Revenue / User" } })
    await waitFor(() => expect(keyInput).toHaveValue("revenue_user"))
  })

  it("keeps the key read-only and omits it from edit submissions", async () => {
    const { onSubmit } = renderSheet(metric)
    const keyInput = screen.getByLabelText("Key")
    expect(keyInput).toHaveAttribute("readonly")
    expect(keyInput).toHaveValue("checkout_completed")
    expect(
      screen.getByText(/Used by 1 experiments across 1 runs/)
    ).toBeVisible()

    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: "Checkout completed" },
    })
    const form = keyInput.closest("form")
    expect(form).not.toBeNull()
    if (!form) throw new Error("Expected the edit form to be rendered")
    fireEvent.submit(form)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: "Checkout completed",
      description: "Completed checkout",
      metricType: "binary",
      metricAgg: "once",
    })
  })

  it("renders Numeric value while submitting the numeric metric type", async () => {
    const { onSubmit } = renderSheet({
      ...metric,
      metricType: "numeric",
      metricAgg: "sum",
    })

    expect(screen.getByRole("combobox", { name: "Type *" })).toHaveTextContent(
      "Numeric value"
    )
    expect(
      screen.getByRole("combobox", { name: "Aggregation *" })
    ).toHaveTextContent("Sum values")
    expect(
      screen.getByRole("combobox", { name: "Type *" })
    ).not.toHaveTextContent("numeric")

    const form = screen.getByLabelText("Key").closest("form")
    expect(form).not.toBeNull()
    if (!form) throw new Error("Expected the edit form to be rendered")
    fireEvent.submit(form)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      metricType: "numeric",
      metricAgg: "sum",
    })
  })
})
