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

function renderEditor() {
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
          property: "country",
          op: "IsOneOf",
          value: JSON.stringify(["legacy"]),
        },
      ],
    })
    return (
      <>
        <RuleEditor
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
