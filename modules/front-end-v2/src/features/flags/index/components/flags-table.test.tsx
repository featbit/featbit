import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import type { FeatureFlag } from "../../flags-types"
import { variationMarkerColor } from "../../variation-colors"
import { FlagsTable } from "./flags-table"

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout redesign",
  key: "checkout-redesign",
  tags: [],
  isEnabled: true,
  createdAt: "2026-07-01T10:00:00Z",
  updatedAt: "2026-07-01T10:00:00Z",
  creator: {
    id: "author-1",
    name: "Maya Chen",
    email: "maya@example.com",
  },
  lastChange: {
    operator: {
      id: "updater-1",
      name: "Jordan Lee",
      email: "jordan@example.com",
    },
    happenedAt: "2026-07-01T11:00:00Z",
  },
  variationType: "boolean",
  variations: [
    { id: "available", name: "Available", value: "true" },
    { id: "unavailable", name: "Unavailable", value: "false" },
  ],
  serves: {
    enabledVariations: ["true", "false"],
    disabledVariation: "false",
  },
}

describe("FlagsTable serving markers", () => {
  function renderTable(item: FeatureFlag = flag) {
    const noop = vi.fn()
    render(
      <MemoryRouter>
        <TooltipProvider>
          <FlagsTable
            lang="en"
            items={[item]}
            loading={false}
            archived={false}
            hasFilters={false}
            selectedIds={new Set()}
            mutatingId={null}
            canToggle={() => true}
            canArchive={() => true}
            canRestore={() => true}
            canRemove={() => true}
            onToggleSelected={noop}
            onTogglePage={noop}
            onToggle={noop}
            onCopyKey={noop}
            onCopyTo={noop}
            onClone={noop}
            onCompare={noop}
            onArchive={noop}
            onRestore={noop}
            onRemove={noop}
            onClearFilters={noop}
            onCreate={noop}
            canCreate
          />
        </TooltipProvider>
      </MemoryRouter>
    )
  }

  it("uses the shared Targeting variation colors", () => {
    renderTable()
    const serving = screen.getByText("Serving:").parentElement
    const markers = serving?.querySelectorAll(".rounded-full") ?? []
    expect(markers).toHaveLength(2)
    expect(markers[0]).toHaveClass(...variationMarkerColor(0).split(" "))
    expect(markers[1]).toHaveClass(...variationMarkerColor(1).split(" "))
  })

  it("links creator and last-change operator to Team member details and shows emails on hover", async () => {
    renderTable()

    const creatorLink = screen.getByRole("link", { name: "Maya Chen" })
    expect(creatorLink).toHaveAttribute(
      "href",
      "/en/iam/team/author-1/permissions"
    )
    expect(creatorLink).toHaveAttribute("target", "_blank")
    expect(creatorLink).toHaveAttribute("rel", "noopener noreferrer")
    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(creatorLink)
    expect(await screen.findByText("maya@example.com")).toBeInTheDocument()

    const updaterLink = screen.getByRole("link", { name: "Jordan Lee" })
    expect(updaterLink).toHaveAttribute(
      "href",
      "/en/iam/team/updater-1/permissions"
    )
    expect(updaterLink).toHaveAttribute("target", "_blank")
    expect(updaterLink).toHaveAttribute("rel", "noopener noreferrer")
    fireEvent.mouseLeave(creatorLink)
    fireEvent.mouseEnter(updaterLink)
    expect(await screen.findByText("jordan@example.com")).toBeInTheDocument()
  })

  it("shows variation names and reveals both names and values on hover", async () => {
    renderTable()

    const serving = screen.getByText("Serving:").parentElement
    expect(serving).toHaveTextContent("Available, Unavailable")
    expect(serving).not.toHaveTextContent("true, false")

    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(serving!)

    const tooltip = (await screen.findByText("true")).closest<HTMLElement>(
      '[data-slot="tooltip-content"]'
    )
    expect(tooltip).not.toBeNull()
    if (!tooltip) throw new Error("Expected the serving tooltip to be rendered")
    expect(within(tooltip).getByText("Available")).toBeVisible()
    expect(within(tooltip).getByText("Unavailable")).toBeVisible()
    expect(within(tooltip).getByText("true")).toBeVisible()
    expect(within(tooltip).getByText("false")).toBeVisible()
  })

  it("falls back to the value when a variation has no name", async () => {
    renderTable({
      ...flag,
      isEnabled: false,
      variations: [
        { id: "available", name: "Available", value: "true" },
        { id: "unavailable", name: "   ", value: "false" },
      ],
    })

    const serving = screen.getByText("Serving:").parentElement
    expect(serving).toHaveTextContent("false")

    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(serving!)

    const tooltip = (await screen.findByText("Value")).closest<HTMLElement>(
      '[data-slot="tooltip-content"]'
    )
    expect(tooltip).not.toBeNull()
    if (!tooltip) throw new Error("Expected the serving tooltip to be rendered")
    expect(within(tooltip).getByText("Name")).toBeVisible()
    expect(within(tooltip).getByText("—")).toBeVisible()
    expect(within(tooltip).getByText("Value")).toBeVisible()
    expect(within(tooltip).getByText("false")).toBeVisible()
  })
})
