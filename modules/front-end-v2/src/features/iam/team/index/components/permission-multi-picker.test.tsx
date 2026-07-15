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

function PickerInSheet() {
  const [selected, setSelected] = useState<PolicyOption[]>([])
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
    expect(screen.getByRole("button", { name: "Selected (0)" })).toBeDisabled()
    expect(screen.queryByText("No results found.")).not.toBeInTheDocument()
  })
})
