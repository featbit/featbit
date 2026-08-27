import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import { FlagsToolbar } from "./flags-toolbar"

type FlagsToolbarProps = ComponentProps<typeof FlagsToolbar>

function renderToolbar(overrides: Partial<FlagsToolbarProps> = {}) {
  const onClearFilters = vi.fn()
  const noop = vi.fn()

  render(
    <TooltipProvider>
      <FlagsToolbar
        lang="en"
        search=""
        tags={[]}
        selectedTags={[]}
        tagsLoading={false}
        status="all"
        archived={false}
        selectedCount={0}
        canCopySelected
        onSearchChange={noop}
        onTagsChange={noop}
        onStatusChange={noop}
        onArchivedChange={noop}
        onClearFilters={onClearFilters}
        onClearSelection={noop}
        onCopySelected={noop}
        onCompare={noop}
        onCreate={noop}
        {...overrides}
      />
    </TooltipProvider>
  )

  return onClearFilters
}

describe("FlagsToolbar", () => {
  it("keeps New flag clickable so the page can check permission", () => {
    const onCreate = vi.fn()
    renderToolbar({ onCreate })

    const button = screen.getByRole("button", { name: "New flag" })
    expect(button).toBeEnabled()
    fireEvent.click(button)

    expect(onCreate).toHaveBeenCalledOnce()
  })

  it("hides Clear filters when no filter is applied", () => {
    renderToolbar()

    expect(
      screen.queryByRole("button", { name: "Clear filters" })
    ).not.toBeInTheDocument()
  })

  it.each<[string, Partial<FlagsToolbarProps>]>([
    ["search", { search: "checkout" }],
    ["tag", { selectedTags: ["release"] }],
    ["status", { status: "on" }],
    ["archived", { archived: true }],
  ])("shows Clear filters when the %s filter is applied", (_, overrides) => {
    const onClearFilters = renderToolbar(overrides)

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))

    expect(onClearFilters).toHaveBeenCalledOnce()
  })
})
