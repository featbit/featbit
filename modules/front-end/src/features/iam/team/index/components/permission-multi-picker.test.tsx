import { fireEvent, render, screen } from "@testing-library/react"
import { useRef, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import "@/lib/i18n/i18n"
import type { PolicyOption } from "../../team-api"
import { PolicyMultiPicker } from "./permission-multi-picker"

vi.mock("../../team-api", () => ({
  fetchPolicyOptions: vi.fn(() => new Promise(() => undefined)),
  fetchGroupOptions: vi.fn(() => new Promise(() => undefined)),
}))

const policy: PolicyOption = {
  id: "policy-1",
  name: "Policy one",
  type: "CustomerManaged",
}

function PickerInSheet({
  initialSelected = [],
}: {
  initialSelected?: PolicyOption[]
}) {
  const [selected, setSelected] = useState<PolicyOption[]>(initialSelected)
  const sheetContentRef = useRef<HTMLDivElement | null>(null)
  return (
    <Sheet open>
      <SheetContent ref={sheetContentRef}>
        <PolicyMultiPicker
          portalContainer={sheetContentRef}
          selected={selected}
          onSelectedChange={setSelected}
        />
      </SheetContent>
    </Sheet>
  )
}

describe("PolicyMultiPicker", () => {
  it("opens its selector from inside a sheet", () => {
    render(<PickerInSheet />)

    const manageButton = screen.getByRole("button", { name: "Manage" })
    fireEvent.click(manageButton)

    const input = screen.getByPlaceholderText("Search policies")
    expect(input.closest("[data-open]")).not.toBeNull()
    expect(input.closest('[data-slot="sheet-content"]')).not.toBeNull()
    expect(screen.getByRole("tab", { name: "Selected (0)" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
    expect(screen.queryByText("No results found.")).not.toBeInTheDocument()
  })

  it("returns to All after removing the last selected option", () => {
    render(<PickerInSheet initialSelected={[policy]} />)

    fireEvent.click(screen.getByRole("button", { name: "Manage" }))
    fireEvent.click(screen.getByRole("tab", { name: "Selected (1)" }))
    fireEvent.click(screen.getByRole("option", { name: "Policy one" }))

    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByRole("tab", { name: "Selected (0)" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })

  it("returns to All after clearing every selected option", () => {
    render(<PickerInSheet initialSelected={[policy]} />)

    fireEvent.click(screen.getByRole("button", { name: "Manage" }))
    fireEvent.click(screen.getByRole("tab", { name: "Selected (1)" }))
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))

    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByRole("tab", { name: "Selected (0)" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })
})
