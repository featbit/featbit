import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { SegmentReferencesDialog } from "./segment-references-dialog"

describe("SegmentReferencesDialog", () => {
  it("links current-environment references by feature flag key", () => {
    const onClose = vi.fn()

    render(
      <MemoryRouter>
        <SegmentReferencesDialog
          references={[
            {
              envId: "env-1",
              id: "flag-id",
              name: "Checkout flag",
              key: "checkout-flag",
            },
            {
              envId: "env-2",
              id: "other-flag-id",
              name: "Other environment flag",
              key: "other-environment-flag",
            },
          ]}
          segmentName="Release users"
          envId="env-1"
          lang="en"
          onClose={onClose}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Checkout flag").closest("a")).toHaveAttribute(
      "href",
      "/en/feature-flags/checkout-flag/targeting"
    )
    expect(
      screen.getByText("Other environment flag").closest("a")
    ).toBeNull()
    expect(screen.getByText("Not in this environment")).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0])
    expect(onClose).toHaveBeenCalledOnce()
  })
})
