import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
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

  const contractError =
    "Choose a unit that is compatible with the measurement kind."

  it.each([
    ["Gauge", "count", { kind: "count" }],
    [
      "Gauge",
      "percent (0–100)",
      { kind: "percent", scale: "zero_to_one_hundred" },
    ],
    ["Gauge", "ratio (0–1)", { kind: "ratio", scale: "zero_to_one" }],
    ["Gauge", "millisecond", { kind: "duration", base: "millisecond" }],
    ["Gauge", "byte", { kind: "data", base: "byte" }],
    ["Count", "count", { kind: "count" }],
    [
      "Ratio",
      "percent (0–100)",
      { kind: "percent", scale: "zero_to_one_hundred" },
    ],
    ["Ratio", "ratio (0–1)", { kind: "ratio", scale: "zero_to_one" }],
    [
      "Rate",
      "structured rate",
      { kind: "rate", numerator: "requests", per: "second" },
    ],
  ] as const)(
    "clears the stale error before submit and saves %s + %s",
    async (measurementKind, unitLabel, expectedUnit) => {
      const create = vi.fn().mockResolvedValue(undefined)
      render(
        <MetricDefinitionSheet open onOpenChange={vi.fn()} onCreate={create} />
      )

      // Start from an incompatible unit, including Rate -> Gauge.
      if (measurementKind !== "Rate") {
        await choose("Measurement kind", "Rate")
        expect(screen.getByLabelText("Measurement kind")).toHaveTextContent(
          "Rate"
        )
        await choose("Unit", "structured rate")
        expect(screen.getByLabelText("Unit")).toHaveTextContent(
          "structured rate"
        )
      }
      await choose("Measurement kind", measurementKind)
      expect(screen.getByLabelText("Measurement kind")).toHaveTextContent(
        measurementKind
      )
      expect(screen.getByLabelText("Unit")).toHaveTextContent("Choose a unit")
      expect(await screen.findByText(contractError)).toBeVisible()

      await choose("Unit", unitLabel)
      expect(screen.getByLabelText("Unit")).toHaveTextContent(unitLabel)
      await waitFor(() => expect(screen.queryByText(contractError)).toBeNull())

      fillDefinition()
      fireEvent.click(screen.getByRole("button", { name: "Create metric" }))
      await waitFor(() => expect(create).toHaveBeenCalledOnce())
      expect(create.mock.calls[0][0].resultContract).toMatchObject({
        measurementKind: measurementKind.toLowerCase(),
        unit: expectedUnit,
      })
    }
  )

  it("requires a new compatible unit instead of submitting the previous unit", async () => {
    const create = vi.fn()
    render(
      <MetricDefinitionSheet open onOpenChange={vi.fn()} onCreate={create} />
    )
    fillDefinition()
    await choose("Measurement kind", "Count")
    fireEvent.click(screen.getByRole("button", { name: "Create metric" }))
    expect(await screen.findByText(contractError)).toBeVisible()
    expect(create).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText("Unit"))
    expect(
      await screen.findByRole("option", { name: "count" })
    ).toBeVisible()
    expect(screen.getAllByRole("option")).toHaveLength(1)
  })

  it("revalidates repeated kind and unit changes without erasing a compatible selection", async () => {
    render(<MetricDefinitionSheet open onOpenChange={vi.fn()} />)
    await choose("Measurement kind", "Gauge")
    expect(screen.getByLabelText("Unit")).toHaveTextContent("percent (0–100)")
    expect(screen.queryByText(contractError)).toBeNull()

    for (const [kind, unit] of [
      ["Count", "count"],
      ["Ratio", "ratio (0–1)"],
      ["Rate", "structured rate"],
      ["Gauge", "millisecond"],
      ["Ratio", "percent (0–100)"],
    ]) {
      await choose("Measurement kind", kind)
      expect(await screen.findByText(contractError)).toBeVisible()
      await choose("Unit", unit)
      await waitFor(() => expect(screen.queryByText(contractError)).toBeNull())
    }
  })

  it("configures a structured rate instead of a provider calculation", async () => {
    render(<MetricDefinitionSheet open onOpenChange={vi.fn()} />)

    await choose("Measurement kind", "Rate")
    await choose("Unit", "structured rate")

    expect(screen.getByLabelText("Unit")).toHaveTextContent("structured rate")
    expect(screen.getByLabelText("Numerator unit")).toHaveTextContent(
      "requests"
    )
    expect(screen.getByLabelText("Per")).toHaveTextContent("second")
    expect(screen.getByText(/Rate · requests \/ second/)).toBeVisible()
    await choose("Numerator unit", "bytes")
    await choose("Per", "hour")
    expect(screen.getByText(/Rate · bytes \/ hour/)).toBeVisible()
    await waitFor(() => expect(screen.queryByText(contractError)).toBeNull())
    expect(screen.queryByLabelText("Calculation")).toBeNull()
  })

  function fillDefinition() {
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Checkout reliability" },
    })
    fireEvent.change(screen.getByLabelText("Key"), {
      target: { value: "checkout_reliability" },
    })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Business-owned description" },
    })
    fireEvent.change(screen.getByLabelText("Result semantics"), {
      target: {
        value: "Percentage of failed checkout requests in the query window.",
      },
    })
  }

  it("submits all original definition fields and no provider or environment configuration", async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    render(
      <MetricDefinitionSheet open onOpenChange={vi.fn()} onCreate={create} />
    )
    fillDefinition()
    await choose("Category", "Reliability")
    await choose("Fraction digits", "3")
    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "1" },
    })
    fireEvent.change(screen.getByLabelText("Maximum"), {
      target: { value: "80" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create metric" }))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    const value = create.mock.calls[0][0]
    expect(value).toMatchObject({
      name: "Checkout reliability",
      key: "checkout_reliability",
      description: "Business-owned description",
      category: "reliability",
      fractionDigits: 3,
      resultContract: {
        measurementKind: "ratio",
        unit: { kind: "percent", scale: "zero_to_one_hundred" },
        constraints: {
          minimum: 1,
          maximum: 80,
          allowNaN: false,
          allowInfinity: false,
        },
      },
    })
    expect(value).not.toHaveProperty("providerConfig")
    expect(value).not.toHaveProperty("environmentId")
  })

  it("keeps the drawer and its values on duplicate key errors", async () => {
    const close = vi.fn()
    render(
      <MetricDefinitionSheet
        open
        onOpenChange={close}
        onCreate={vi.fn().mockRejectedValue(new Error("metric_key_exists"))}
      />
    )
    fillDefinition()
    fireEvent.click(screen.getByRole("button", { name: "Create metric" }))
    expect(
      await screen.findByText("This key is already used in this project.")
    ).toBeVisible()
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Business-owned description"
    )
    expect(close).not.toHaveBeenCalled()
  })

  it("rejects constraints that widen canonical percent bounds", async () => {
    const create = vi.fn()
    render(
      <MetricDefinitionSheet open onOpenChange={vi.fn()} onCreate={create} />
    )
    fillDefinition()
    fireEvent.change(screen.getByLabelText("Maximum"), {
      target: { value: "101" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create metric" }))
    await waitFor(() =>
      expect(screen.getByLabelText("Maximum")).toHaveAttribute(
        "aria-invalid",
        "true"
      )
    )
    expect(create).not.toHaveBeenCalled()
  })

  it("asks before discarding unsaved input", async () => {
    const close = vi.fn()
    render(
      <MetricDefinitionSheet open onOpenChange={close} onCreate={vi.fn()} />
    )
    fillDefinition()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(await screen.findByRole("alertdialog")).toBeVisible()
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(screen.getByLabelText("Name")).toHaveValue("Checkout reliability")
  })
})
