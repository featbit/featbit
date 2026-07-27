import { render, screen } from "@testing-library/react"
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
  serves: {
    enabledVariations: ["Variation A", "Variation B"],
    disabledVariation: "Variation B",
  },
}

describe("FlagsTable serving markers", () => {
  it("uses the shared Targeting variation colors", () => {
    const noop = vi.fn()
    render(
      <MemoryRouter>
        <TooltipProvider>
          <FlagsTable
            lang="en"
            items={[flag]}
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

    const serving = screen.getByText("Serving:").parentElement
    const markers = serving?.querySelectorAll(".rounded-full") ?? []
    expect(markers).toHaveLength(2)
    expect(markers[0]).toHaveClass(...variationMarkerColor(0).split(" "))
    expect(markers[1]).toHaveClass(...variationMarkerColor(1).split(" "))
  })
})
