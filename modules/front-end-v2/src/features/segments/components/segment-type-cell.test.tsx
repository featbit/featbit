import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import "@/lib/i18n/i18n"
import { SegmentTypeCell } from "./segment-type-cell"

describe("SegmentTypeCell", () => {
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
