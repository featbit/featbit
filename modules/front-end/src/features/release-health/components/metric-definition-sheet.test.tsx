import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { i18n } from "@/lib/i18n/i18n"
import { MetricDefinitionSheet } from "./metric-definition-sheet"

async function choose(label: string, optionName: string) {
  fireEvent.click(screen.getByLabelText(label))
  const option = await screen.findByRole("option", { name: optionName })
  fireEvent.pointerDown(option, { pointerType: "mouse" })
  fireEvent.click(option)
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

  it("creates only a project metric definition", () => {
    render(<MetricDefinitionSheet open onOpenChange={vi.fn()} />)

    expect(
      screen.getByRole("heading", { name: "Add release metric" })
    ).toBeVisible()
    expect(screen.getByText("Metric semantics")).toBeVisible()
    expect(screen.queryByText("Environment source binding")).toBeNull()
    expect(screen.queryByText("Observation scope")).toBeNull()
    expect(screen.queryByText("Event / instrument")).toBeNull()
  })

  it("uses category to choose recommended templates and fills the contract", async () => {
    render(<MetricDefinitionSheet open onOpenChange={vi.fn()} />)

    expect(screen.getByLabelText("Metric template")).toHaveTextContent(
      "Error rate"
    )
    expect(screen.getByLabelText("Value type")).toHaveTextContent("Ratio")
    expect(screen.getByLabelText("Value type")).toBeDisabled()

    await choose("Category", "Impact")
    await choose("Metric template", "Completed orders")

    expect(screen.getByLabelText("Metric template")).toHaveTextContent(
      "Completed orders"
    )
    expect(screen.getByLabelText("Value type")).toHaveTextContent("Count")
    expect(screen.getByLabelText("Calculation")).toHaveTextContent("Sum")
    expect(screen.getByLabelText("Unit")).toHaveTextContent("count")
    await waitFor(() => {
      expect(
        screen.queryByText(
          "Choose a calculation and unit that are compatible with the value type."
        )
      ).toBeNull()
    })
  })

  it("unlocks a custom contract and reconciles dependent fields", async () => {
    render(<MetricDefinitionSheet open onOpenChange={vi.fn()} />)

    await choose("Metric template", "Custom")
    expect(screen.getByLabelText("Value type")).not.toBeDisabled()

    await choose("Value type", "Gauge")

    expect(screen.getByLabelText("Calculation")).toHaveTextContent(
      "Latest value"
    )
    expect(screen.getByLabelText("Unit")).toHaveTextContent("count")
    fireEvent.click(screen.getByLabelText("Calculation"))
    expect(screen.queryByRole("option", { name: "P95" })).toBeNull()
  })
})
