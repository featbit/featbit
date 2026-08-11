import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { AuditLogFilters } from "./audit-log-filters"

function renderFilters(filtersApplied: boolean) {
  const onClear = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AuditLogFilters
        locale="en-US"
        search=""
        user={null}
        refType=""
        range={undefined}
        filtersApplied={filtersApplied}
        onSearchChange={vi.fn()}
        onUserChange={vi.fn()}
        onRefTypeChange={vi.fn()}
        onRangeChange={vi.fn()}
        onClear={onClear}
      />
    </QueryClientProvider>
  )

  return onClear
}

describe("AuditLogFilters", () => {
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
