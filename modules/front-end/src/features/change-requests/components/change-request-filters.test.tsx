import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { ChangeRequestFilters } from "./change-request-filters"

function renderFilters(filtersApplied: boolean) {
  const onClear = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <ChangeRequestFilters
        query=""
        author={null}
        reviewer={null}
        status={undefined}
        filtersApplied={filtersApplied}
        onQueryChange={vi.fn()}
        onAuthorChange={vi.fn()}
        onReviewerChange={vi.fn()}
        onStatusChange={vi.fn()}
        onClear={onClear}
      />
    </QueryClientProvider>
  )

  return onClear
}

describe("ChangeRequestFilters", () => {
  it("hides Clear filters when no filter is applied", () => {
    renderFilters(false)

    expect(
      screen.queryByRole("button", { name: "Clear filters" })
    ).not.toBeInTheDocument()
  })

  it("shows Clear filters when a filter is applied", () => {
    const onClear = renderFilters(true)

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))

    expect(onClear).toHaveBeenCalledOnce()
  })
})
