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

  it("shows variation names and reveals both names and values on hover", async () => {
    renderTable()

    const serving = screen.getByText("Serving:").parentElement
    expect(serving).toHaveTextContent("Available, Unavailable")
    expect(serving).not.toHaveTextContent("true, false")

    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(serving!)

    const tooltip = (await screen.findByText("true")).closest(
      '[data-slot="tooltip-content"]'
    )
    expect(tooltip).not.toBeNull()
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

    const tooltip = (await screen.findByText("Value")).closest(
      '[data-slot="tooltip-content"]'
    )
    expect(tooltip).not.toBeNull()
    expect(within(tooltip).getByText("Name")).toBeVisible()
    expect(within(tooltip).getByText("—")).toBeVisible()
    expect(within(tooltip).getByText("Value")).toBeVisible()
    expect(within(tooltip).getByText("false")).toBeVisible()
  })
})
