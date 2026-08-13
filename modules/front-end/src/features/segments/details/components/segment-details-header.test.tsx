import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import "@/lib/i18n/i18n"
import type { Segment } from "../../segments-types"
import { SegmentDetailsHeader } from "./segment-details-header"

const segment: Segment = {
  id: "segment-1",
  name: "Shared segment",
  key: "shared-segment",
  type: "shared",
  scopes: [
    "organization/acme",
    "organization/acme:project/payments",
    "organization/acme:project/payments:env/production",
  ],
  tags: [],
  description: "",
  updatedAt: "2026-07-24T08:00:00.000Z",
  isArchived: false,
  included: [],
  excluded: [],
  rules: [],
}

describe("SegmentDetailsHeader", () => {
  it("shows the segment lifecycle state", () => {
    const { rerender } = render(
      <MemoryRouter>
        <SegmentDetailsHeader
          segment={segment}
          references={[]}
          activeTab="settings"
          basePath="/en-US/segments"
          envId="env-1"
          lang="en"
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Active")).toBeVisible()

    rerender(
      <MemoryRouter>
        <SegmentDetailsHeader
          segment={{ ...segment, isArchived: true }}
          references={[]}
          activeTab="settings"
          basePath="/en-US/segments"
          envId="env-1"
          lang="en"
        />
      </MemoryRouter>
    )

    expect(screen.getByText("Archived")).toBeVisible()
  })

  it("matches the Team details back-link treatment", () => {
    render(
      <MemoryRouter>
        <SegmentDetailsHeader
          segment={segment}
          references={[]}
          activeTab="targeting"
          basePath="/en-US/segments"
          envId="env-1"
          lang="en"
        />
      </MemoryRouter>
    )

    const backLink = screen.getByRole("link", { name: "Segments" })
    expect(backLink).toHaveClass(
      "mb-5",
      "gap-1.5",
      "text-muted-foreground",
      "hover:text-foreground"
    )
    expect(backLink.querySelector("svg")).toHaveClass("lucide-arrow-left")
  })

  it("shows the corresponding icon for every shared scope", async () => {
    render(
      <MemoryRouter>
        <SegmentDetailsHeader
          segment={segment}
          references={[]}
          activeTab="targeting"
          basePath="/en-US/segments"
          envId="env-1"
          lang="en"
        />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: "3 scopes" }))

    const organization = await screen.findByText("organization/acme")
    const project = screen.getByText("organization/acme:project/payments")
    const environment = screen.getByText(
      "organization/acme:project/payments:env/production"
    )

    expect(organization.previousElementSibling).toHaveClass("lucide-building-2")
    expect(project.previousElementSibling).toHaveClass("lucide-folder")
    expect(environment.previousElementSibling).toHaveClass("lucide-box")
  })
})
