import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { useAuditLogFilters } from "../use-audit-log-filters"
import { AuditLogPageContent } from "./audit-log-page-content"

type Props = ComponentProps<typeof AuditLogPageContent>

function renderContent(overrides: Partial<Props> = {}) {
  function Content() {
    const filters = useAuditLogFilters()
    return (
      <AuditLogPageContent
        lang="en"
        locale="en"
        subtitle="Audit history"
        filters={filters}
        items={[]}
        contextMissing={false}
        loading={false}
        nextPageError={false}
        hasNextPage={false}
        fetchingNextPage={false}
        onLoadMore={vi.fn()}
        {...overrides}
      />
    )
  }
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <Content />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("AuditLogPageContent", () => {
  it("allows retrying an initial load failure", () => {
    const onRetry = vi.fn()
    renderContent({ initialError: "Load failed", onRetry })
    expect(screen.getByText("Load failed")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("shows a non-retryable error when the page does not supply a retry action", () => {
    renderContent({ iam: true, initialError: "Permission denied" })
    expect(screen.getByText("Permission denied")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument()
  })

  it("offers pagination retry even when there is no known next page", () => {
    const onLoadMore = vi.fn()
    renderContent({ nextPageError: true, onLoadMore })
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it("disables loading more while the next page is being fetched", () => {
    renderContent({ hasNextPage: true, fetchingNextPage: true })
    expect(screen.getByRole("button", { name: "Load more" })).toBeDisabled()
  })
})
