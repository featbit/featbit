import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { Metric } from "../metrics-types"
import { MetricSheet } from "./metric-sheet"

const metric: Metric = {
  id: "metric-id",
  envId: "env-id",
  name: "Checkout conversion",
  key: "checkout_completed",
  eventName: "purchase",
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
  it("requires an SDK event name and submits it independently of the metric key", async () => {
    const { onSubmit } = renderSheet(null)
    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: "Purchase conversion" },
    })
    const eventInput = screen.getByLabelText("Event name *")
    const form = eventInput.closest("form")!
    fireEvent.submit(form)
    await waitFor(() =>
      expect(screen.getByText("Enter an event name.")).toBeVisible()
    )
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.change(eventInput, { target: { value: " purchase " } })
    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: "Completed purchases" },
    })
    await waitFor(() =>
      expect(screen.getByLabelText("Key *")).toHaveValue("completed-purchases")
    )
    expect(eventInput).toHaveValue(" purchase ")
    fireEvent.submit(form)
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "completed-purchases",
          eventName: "purchase",
        })
      )
    )
  })

  it("regenerates the key when the name changes after a manual key edit", async () => {
    renderSheet(null)

    const nameInput = screen.getByLabelText("Name *")
    const keyInput = screen.getByLabelText("Key *")
    expect(keyInput).not.toHaveAttribute("readonly")

    fireEvent.change(nameInput, { target: { value: "Revenue / User" } })
    await waitFor(() => expect(keyInput).toHaveValue("revenue-user"))

    fireEvent.change(nameInput, { target: { value: "Revenue__Per.User:V2!" } })
    await waitFor(() => expect(keyInput).toHaveValue("revenue-peruserv2"))

    fireEvent.change(keyInput, { target: { value: "revenue_custom.v2:sum" } })
    await waitFor(() => expect(keyInput).toHaveValue("revenue_custom.v2:sum"))

    fireEvent.change(nameInput, { target: { value: "Updated revenue" } })
    await waitFor(() => expect(keyInput).toHaveValue("updated-revenue"))

    fireEvent.change(nameInput, { target: { value: "" } })
    await waitFor(() => expect(keyInput).toHaveValue(""))
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
    fireEvent.change(screen.getByLabelText("Event name *"), {
      target: { value: "purchase_completed" },
    })
    await waitFor(() => expect(keyInput).toHaveValue("checkout_completed"))
    const form = keyInput.closest("form")
    expect(form).not.toBeNull()
    if (!form) throw new Error("Expected the edit form to be rendered")
    fireEvent.submit(form)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: "Checkout completed",
      eventName: "purchase_completed",
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
