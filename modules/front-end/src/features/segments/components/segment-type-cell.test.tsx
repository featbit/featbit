import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import "@/lib/i18n/i18n"
import { SegmentTypeCell } from "./segment-type-cell"

describe("SegmentTypeCell", () => {
  it("shows a discoverable info affordance for every segment type", () => {
    const { rerender } = render(<SegmentTypeCell type="environment-specific" />)

    const environmentTrigger = screen.getByText(
      "Current environment"
    ).parentElement
    expect(environmentTrigger).toHaveClass(
      "cursor-help",
      "inline-flex",
      "hover:bg-muted"
    )
    expect(
      environmentTrigger?.querySelector(".lucide-info")
    ).toBeInTheDocument()

    rerender(<SegmentTypeCell type="shared" />)

    const sharedTrigger = screen.getByRole("button", { name: "Shareable" })
    expect(sharedTrigger).toHaveClass(
      "cursor-help",
      "inline-flex",
      "hover:bg-muted"
    )
    expect(sharedTrigger.querySelector(".lucide-info")).toBeInTheDocument()
  })

  it("shows the shared-scope preview above a sheet", async () => {
    render(
      <Sheet open>
        <SheetContent>
          <SegmentTypeCell
            type="shared"
            scopes={["organization/acme:project/payments"]}
          />
        </SheetContent>
      </Sheet>
    )

    const trigger = screen.getByRole("button", { name: "Shareable" })
    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(trigger)

    const scope = await screen.findByText("organization/acme:project/payments")
    expect(
      scope.closest('[data-slot="segment-type-preview-positioner"]')
    ).toHaveClass("z-[60]")
  })
})
