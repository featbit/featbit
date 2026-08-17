import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { LicenseGateDialog } from "./license-gate-card"

describe("LicenseGateDialog", () => {
  it("offers license management and a single close action", () => {
    const onOpenChange = vi.fn()

    render(
      <MemoryRouter>
        <LicenseGateDialog
          open
          title="Your license doesn't include Schedule Changes"
          description="Upgrade your license to schedule Targeting changes."
          actionLabel="Manage license"
          actionHref="/en/workspace/license"
          note="After upgrading, scheduling is available here."
          closeLabel="Close"
          onOpenChange={onOpenChange}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("heading", {
        name: "Your license doesn't include Schedule Changes",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Manage license" })
    ).toHaveAttribute("href", "/en/workspace/license")
    const note = screen.getByText(
      "After upgrading, scheduling is available here."
    ).parentElement
    expect(note).toHaveClass("items-start", "text-left")
    expect(note?.querySelector("svg")).toHaveClass("mt-0.5")
    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass(
      "sm:max-w-xl",
      "overflow-hidden"
    )
    const footer = document.querySelector('[data-slot="dialog-footer"]')
    expect(footer).toHaveClass("border-t-0", "bg-transparent")

    fireEvent.click(
      within(footer as HTMLElement).getByRole("button", { name: "Close" })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
