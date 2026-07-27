import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
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
        <FlagDetailsHeader flag={flag} basePath="/en-US/feature-flags" />
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

  it("shows read-only status first in the summary row", () => {
    render(
      <MemoryRouter>
        <FlagDetailsHeader flag={flag} basePath="/en-US/feature-flags" />
      </MemoryRouter>
    )

    expect(screen.getByRole("heading", { name: flag.name })).toBeVisible()
    const statusLabel = screen.getByText("Status")
    const summaryRow = statusLabel.parentElement?.parentElement
    expect(summaryRow).toHaveClass("mt-4", "flex-wrap")
    expect(summaryRow?.firstElementChild).toBe(statusLabel.parentElement)
    expect(statusLabel.parentElement).toHaveTextContent("ON")
    expect(screen.getByText("Active")).toBeVisible()
    expect(screen.queryByRole("switch")).toBeNull()
  })

  it("shows archived lifecycle state separately from serving status", () => {
    render(
      <MemoryRouter>
        <FlagDetailsHeader
          flag={{ ...flag, isArchived: true }}
          basePath="/en-US/feature-flags"
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Archived")).toBeVisible()
    expect(screen.getByText("Status").parentElement).toHaveTextContent("ON")
  })

  it("places Settings immediately after Variations", () => {
    render(
      <MemoryRouter>
        <FlagDetailsHeader flag={flag} basePath="/en-US/feature-flags" />
      </MemoryRouter>
    )

    const tabs = screen.getByRole("navigation", {
      name: "Feature flag details",
    })
    expect(Array.from(tabs.children).map((tab) => tab.textContent)).toEqual([
      "Targeting",
      "Variations",
      "Settings",
      "Triggers",
      "Insights",
      "History",
    ])
  })
})
