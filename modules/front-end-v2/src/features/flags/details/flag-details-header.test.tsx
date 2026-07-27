import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { FeatureFlag } from "../flags-types"
import { FlagDetailsHeader } from "./flag-details-header"

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout redesign",
  key: "checkout-redesign",
  tags: [],
  isEnabled: true,
  createdAt: "2026-07-01T10:00:00Z",
  updatedAt: "2026-07-01T10:00:00Z",
  variationType: "boolean",
}

describe("FlagDetailsHeader", () => {
  it("matches the Team details back-link treatment", () => {
    render(
      <MemoryRouter>
        <FlagDetailsHeader
          flag={flag}
          basePath="/en-US/feature-flags"
          toggling={false}
          canToggle
          onToggle={vi.fn()}
        />
      </MemoryRouter>
    )

    const backLink = screen.getByRole("link", { name: "Feature flags" })
    expect(backLink).toHaveClass(
      "mb-5",
      "gap-1.5",
      "text-muted-foreground",
      "hover:text-foreground"
    )
    expect(backLink.querySelector("svg")).toHaveClass("lucide-arrow-left")
  })
})
