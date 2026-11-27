import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type {
  SegmentRule,
  SegmentUserProperty,
} from "@/features/segments/segments-types"
import { RuleEditor } from "./rule-editor"

window.HTMLElement.prototype.scrollIntoView = vi.fn()

const properties: SegmentUserProperty[] = [
  {
    id: "property-country",
    name: "country",
    presetValues: [
      { id: "preset-de", value: "DE", description: "Germany" },
      { id: "preset-fr", value: "FR", description: "France" },
    ],
    usePresetValuesOnly: true,
    isBuiltIn: false,
    isDigestField: false,
    remark: "",
  },
  {
    id: "property-plan",
    name: "plan",
    presetValues: [],
    usePresetValuesOnly: false,
    isBuiltIn: false,
    isDigestField: false,
    remark: "",
  },
]

function renderEditor(
  op = "IsOneOf",
  value = JSON.stringify(["legacy"]),
  property = "country",
  showValidationErrors = false
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  function Harness() {
    const [rule, setRule] = useState<SegmentRule>({
      id: "rule-1",
      name: "Country rule",
      conditions: [
        {
          id: "condition-1",
          property,
          op,
          value,
        },
      ],
    })
    return (
      <>
        <RuleEditor
          showValidationErrors={showValidationErrors}
          envId="env-1"
          rule={rule}
          properties={properties}
          disabled={false}
          canMoveUp={false}
          canMoveDown={false}
          onDragStart={vi.fn()}
          onDrag={vi.fn()}
          onDragEnd={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onChange={setRule}
          onRemove={vi.fn()}
        />
        <output data-testid="condition-value">
          {rule.conditions[0].value}
        </output>
      </>
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  )
}

function selectOperator(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Select operator" }))
  const option = screen.getByRole("option", { name })
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 })
  fireEvent.click(option, { detail: 1 })
}

describe("RuleEditor multi-value behavior", () => {
  it("serializes preset selections by value while displaying descriptions", () => {
    renderEditor()

    fireEvent.click(screen.getByRole("combobox", { name: "Select values" }))
    fireEvent.click(screen.getByRole("option", { name: "France" }))

    expect(screen.getByText("France")).toBeVisible()
    expect(screen.getByTestId("condition-value")).toHaveTextContent(
      '["legacy","FR"]'
    )
  })

  it("clears multi-values when the property changes", () => {
    renderEditor()

    fireEvent.click(screen.getByRole("combobox", { name: "Select property" }))
    fireEvent.click(screen.getByRole("option", { name: "plan" }))

    expect(screen.getByTestId("condition-value")).toHaveTextContent("[]")
    expect(screen.queryByText("legacy")).not.toBeInTheDocument()
  })

  it("resets the value whenever the operator changes", () => {
    renderEditor()

    selectOperator("equals")

    expect(screen.getByTestId("condition-value")).toBeEmptyDOMElement()

    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "enterprise" },
    })
    expect(screen.getByTestId("condition-value")).toHaveTextContent(
      "enterprise"
    )

    selectOperator("is not one of")

    expect(screen.getByTestId("condition-value")).toHaveTextContent("[]")

    selectOperator("is true")

    expect(screen.getByTestId("condition-value")).toHaveTextContent("IsTrue")
  })
})

describe("SemVer rule editing", () => {
  it("does not show errors immediately after selecting a SemVer operator", () => {
    renderEditor("Equal", "", "plan")
    selectOperator("SemVer >")
    expect(screen.getByPlaceholderText("Enter a version")).toHaveAttribute(
      "aria-invalid",
      "false"
    )
    expect(screen.getByText(/Examples: 4/)).toHaveClass("text-muted-foreground")
    expect(screen.queryByText("Enter a version.")).not.toBeInTheDocument()
  })

  it("shows required errors after a save attempt and clears them as soon as corrected", () => {
    renderEditor("SemVerBiggerThan", "", "plan", true)
    const input = screen.getByPlaceholderText("Enter a version")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText("Enter a version.")).toBeVisible()
    fireEvent.change(input, { target: { value: "4" } })
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(screen.queryByText("Enter a version.")).not.toBeInTheDocument()
  })

  it("uses a list-specific required message on save", () => {
    renderEditor("SemVerIsOneOf", "[]", "plan", true)
    expect(
      screen.getByRole("combobox", { name: "Select values" })
    ).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText("Add at least one version.")).toBeVisible()
  })

  it("preserves values between comparisons and flags invalid versions", () => {
    renderEditor("SemVerLessThan", "1.2", "plan")
    selectOperator("SemVer >=")
    expect(screen.getByTestId("condition-value")).toHaveTextContent("1.2")
    fireEvent.change(screen.getByPlaceholderText("Enter a version"), {
      target: { value: "1.2.3.4" },
    })
    expect(screen.getByPlaceholderText("Enter a version")).toHaveAttribute(
      "aria-invalid",
      "false"
    )
    fireEvent.blur(screen.getByPlaceholderText("Enter a version"))
    expect(screen.getByPlaceholderText("Enter a version")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(screen.getByText(/Enter a valid version/)).toBeVisible()
  })

  it("requires an explicit choice before reducing a list to one value", () => {
    renderEditor("SemVerIsOneOf", '["1.2","2.0.0"]', "plan")
    selectOperator("SemVer >=")
    expect(screen.getByTestId("condition-value")).toHaveTextContent(
      '["1.2","2.0.0"]'
    )
    fireEvent.click(screen.getByRole("button", { name: "2.0.0" }))
    expect(screen.getByTestId("condition-value")).toHaveTextContent("2.0.0")
    expect(screen.getByPlaceholderText("Enter a version")).toHaveValue("2.0.0")
  })

  it("preserves case-sensitive versions and commits pending input on close", () => {
    renderEditor("SemVerIsOneOf", '["1.2.0-BETA"]', "plan")
    fireEvent.click(screen.getByRole("combobox", { name: "Select values" }))
    fireEvent.change(screen.getByPlaceholderText("Search values"), {
      target: { value: "1.2.0-beta" },
    })
    fireEvent.click(screen.getByRole("option", { name: 'Add "1.2.0-beta"' }))
    expect(screen.getByTestId("condition-value")).toHaveTextContent(
      '["1.2.0-BETA","1.2.0-beta"]'
    )
    fireEvent.click(screen.getByRole("combobox", { name: "Select values" }))
    fireEvent.change(screen.getByPlaceholderText("Search values"), {
      target: { value: "invalid" },
    })
    fireEvent.click(screen.getByRole("combobox", { name: "Select values" }))
    expect(screen.getByTestId("condition-value")).toHaveTextContent('"invalid"')
    expect(screen.getByText(/Each value must be a valid version/)).toBeVisible()
  })

  it.each(["2", "beta"])("discards pending version %s on Escape", (value) => {
    renderEditor("SemVerIsOneOf", '["1.2.3"]', "plan")
    fireEvent.click(screen.getByRole("combobox", { name: "Select values" }))
    fireEvent.change(screen.getByPlaceholderText("Search values"), {
      target: { value },
    })
    fireEvent.keyDown(screen.getByPlaceholderText("Search values"), {
      key: "Escape",
    })
    expect(screen.getByTestId("condition-value")).toHaveTextContent('["1.2.3"]')
    expect(
      screen.queryByText(/Each value must be a valid version/)
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("combobox", { name: "Select values" }))
    expect(screen.getByPlaceholderText("Search values")).toHaveValue("")
  })
})
