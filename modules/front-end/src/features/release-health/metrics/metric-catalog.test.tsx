import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { i18n } from "@/lib/i18n/i18n"
import { MetricCatalog } from "./release-metrics-page"
import type { CatalogEntry } from "./live-metric-data"

const metric: CatalogEntry = {
  id: "m1",
  projectId: "p1",
  metricVersionId: "v1",
  version: 1,
  key: "checkout_error_rate",
  name: "My actual metric name",
  resultSemantics: "My actual metric semantics.",
  category: "reliability",
  description: "My persisted description",
  resultContract: {
    schemaVersion: 1,
    resultKind: "numeric_time_series",
    cardinality: "single",
    measurementKind: "ratio",
    unit: { kind: "percent", scale: "zero_to_one_hundred" },
    constraints: { allowNaN: false, allowInfinity: false },
  },
  status: "not_connected",
  displayValue: "—",
  freshness: "—",
  source: undefined,
}
function catalog(
  overrides: Partial<React.ComponentProps<typeof MetricCatalog>> = {}
) {
  return render(
    <MemoryRouter initialEntries={["/en/release-health/metrics"]}>
      <MetricCatalog
        metrics={[metric]}
        loading={false}
        failed={false}
        canCreate
        onCreate={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>
  )
}
describe("Restored metric catalog", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en")
  })
  it("uses the seven-column catalog and a drawer, not an inline create form or trend selector", () => {
    catalog()
    expect(screen.getAllByRole("columnheader")).toHaveLength(7)
    expect(
      screen.getAllByRole("link", { name: metric.name })[0]
    ).toHaveAttribute("href", "/en/release-health/metrics/checkout_error_rate")
    expect(screen.queryByText("Checkout error rate")).toBeNull()
    expect(screen.queryByLabelText("Name")).toBeNull()
    expect(
      screen.queryByRole("img", { name: "Actual Prometheus metric trend" })
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Add metric" }))
    expect(screen.getByRole("dialog")).toBeVisible()
    expect(screen.getByLabelText("Description")).toBeVisible()
    expect(screen.getByLabelText("Measurement kind")).toBeVisible()
  })
  it("shows missing bindings and unavailable monitor counts without inventing values", () => {
    catalog()
    expect(screen.getAllByText("Not connected").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Not yet available").length).toBeGreaterThan(0)
    expect(screen.queryByText("0 monitors")).toBeNull()
  })
  it("filters by the actual persisted name and key", () => {
    catalog()
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "missing_name" },
    })
    expect(screen.queryByRole("link", { name: metric.name })).toBeNull()
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "checkout_error_rate" },
    })
    expect(
      screen.getAllByRole("link", { name: metric.name }).length
    ).toBeGreaterThan(0)
  })
  it("does not offer creation without project permission", () => {
    catalog({ canCreate: false })
    expect(screen.getByRole("button", { name: "Add metric" })).toBeDisabled()
  })
  it("distinguishes loading and failures from an empty catalog", () => {
    catalog({ metrics: [], failed: true })
    expect(screen.getByText(/Cannot load live data/)).toBeVisible()
    expect(screen.queryByText(/No metrics match/)).toBeNull()
  })
})
