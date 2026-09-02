import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { i18n } from "@/lib/i18n/i18n"
import { MetricDefinitionSheet } from "./metric-definition-sheet"

async function choose(label: string, optionName: string) {
  fireEvent.click(screen.getByLabelText(label))
  const option = await screen.findByRole("option", { name: optionName })
  await act(async () => {
    fireEvent.pointerDown(option, { pointerType: "mouse" })
    fireEvent.click(option)
  })
}

describe("MetricDefinitionSheet", () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem(
      "auth",
      JSON.stringify({ id: "user-1", name: "Designer" })
    )
    localStorage.setItem(
      "current-project_user-1",
      JSON.stringify({
        projectId: "project-commerce",
        projectName: "Commerce",
        projectKey: "commerce",
        envId: "env-production",
        envName: "Production",
        envKey: "production",
      })
    )
    await i18n.changeLanguage("en")
  })

  it("creates only a project metric definition and its first result contract", () => {
    render(<MetricDefinitionSheet open onOpenChange={vi.fn()} />)

    expect(
      screen.getByRole("heading", { name: "Add release metric" })
    ).toBeVisible()
    expect(screen.getByText("Metric semantics")).toBeVisible()
    expect(screen.getByLabelText("Result kind")).toHaveTextContent(
      "Numeric time series"
    )
    expect(screen.getByLabelText("Result kind")).toHaveTextContent(
      "numeric_time_series"
    )
    expect(screen.getByLabelText("Cardinality")).toHaveTextContent(
      "Single series"
    )
    expect(screen.getByLabelText("Cardinality")).toHaveTextContent("single")
    expect(screen.getByLabelText("Category")).toHaveTextContent("Uncategorized")
    expect(screen.queryByText("Environment source binding")).toBeNull()
    expect(screen.queryByText("Observation scope")).toBeNull()
    expect(screen.queryByLabelText("Metric template")).toBeNull()
    expect(screen.queryByLabelText("Calculation")).toBeNull()
  })

  it("keeps the unit compatible when the measurement kind changes", async () => {
    render(<MetricDefinitionSheet open onOpenChange={vi.fn()} />)

    expect(screen.getByLabelText("Measurement kind")).toHaveTextContent("Ratio")
    expect(screen.getByLabelText("Unit")).toHaveTextContent("percent (0–100)")

    await choose("Measurement kind", "Count")

    expect(screen.getByLabelText("Measurement kind")).toHaveTextContent("Count")
    expect(screen.getByLabelText("Unit")).toHaveTextContent("count")
  })

  it("configures a structured rate instead of a provider calculation", async () => {
    render(<MetricDefinitionSheet open onOpenChange={vi.fn()} />)

    await choose("Measurement kind", "Rate")

    expect(screen.getByLabelText("Unit")).toHaveTextContent("structured rate")
    expect(screen.getByLabelText("Numerator unit")).toHaveTextContent(
      "requests"
    )
    expect(screen.getByLabelText("Per")).toHaveTextContent("second")
    expect(screen.getByText(/Rate · requests \/ second/)).toBeVisible()
    expect(screen.queryByLabelText("Calculation")).toBeNull()
  })
})
