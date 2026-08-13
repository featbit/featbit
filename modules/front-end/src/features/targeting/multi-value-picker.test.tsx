import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { MultiValuePicker } from "./multi-value-picker"

window.HTMLElement.prototype.scrollIntoView = vi.fn()

const presets = [
  { id: "preset-de", value: "DE", description: "Germany" },
  { id: "preset-fr", value: "FR", description: "France" },
]

function renderPicker({
  initialValues = [],
  presetOnly = false,
}: {
  initialValues?: string[]
  presetOnly?: boolean
} = {}) {
  function Harness() {
    const [values, setValues] = useState(initialValues)
    return (
      <MultiValuePicker
        values={values}
        presetValues={presets}
        presetOnly={presetOnly}
        disabled={false}
        onChange={setValues}
      />
    )
  }

  return render(<Harness />)
}

describe("MultiValuePicker", () => {
  it("shows preset descriptions while keeping tag-style removal", () => {
    renderPicker({ initialValues: ["DE"] })

    expect(screen.getByText("Germany")).toBeVisible()
    expect(screen.getByRole("button", { name: "Remove Germany" })).toBeVisible()
    expect(screen.queryByText("DE")).not.toBeInTheDocument()
  })

  it("offers presets and custom values when presets are advisory", () => {
    renderPicker()

    fireEvent.click(screen.getByRole("combobox", { name: "Select values" }))
    fireEvent.change(screen.getByPlaceholderText("Search values"), {
      target: { value: "Enterprise" },
    })
    fireEvent.click(screen.getByRole("option", { name: 'Add "Enterprise"' }))

    expect(screen.getByText("Enterprise")).toBeVisible()
  })

  it("restricts creation but preserves legacy values for preset-only properties", () => {
    renderPicker({ initialValues: ["legacy"], presetOnly: true })

    fireEvent.click(screen.getByRole("button", { name: "Remove legacy" }))
    fireEvent.click(screen.getByRole("combobox", { name: "Select values" }))

    expect(screen.getByRole("option", { name: "legacy" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "France" })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("Search values"), {
      target: { value: "Enterprise" },
    })
    expect(
      screen.queryByRole("option", { name: 'Add "Enterprise"' })
    ).not.toBeInTheDocument()
  })
})
