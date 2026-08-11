import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { fetchAuditLogs } from "@/features/audit-logs/audit-logs-api"
import type { AuditLog } from "@/features/audit-logs/audit-logs-types"
import "@/lib/i18n/i18n"
import type { Segment } from "../../segments-types"
import { HistoryTab } from "./history-tab"

vi.mock("@/features/audit-logs/audit-logs-api", () => ({
  fetchAuditLogs: vi.fn(),
  fetchAuditUsers: vi.fn(),
}))

const segment: Segment = {
  id: "segment-1",
  name: "Release users",
  key: "release-users",
  type: "environment-specific",
  scopes: [],
  tags: [],
  description: "",
  updatedAt: "2026-07-24T08:00:00.000Z",
  isArchived: false,
  included: [],
  excluded: [],
  rules: [],
}

const auditLog: AuditLog = {
  id: "audit-1",
  refId: segment.id,
  refType: "Segment",
  operation: "Update",
  creatorId: "user-1",
  creatorName: "Tester",
  creatorEmail: "tester@example.com",
  createdAt: "2026-07-24T08:15:00.000Z",
  comment: "Release after QA approval",
  dataChange: {
    previous: '{"name":"Before"}',
    current: '{"name":"After"}',
  },
  instructions: [{ kind: "UpdateName", value: "After" }],
}

function renderHistory(currentSegment: Segment = segment) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <HistoryTab envId="env-1" segment={currentSegment} lang="en" />
        </TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe("HistoryTab", () => {
  it("reuses the shared audit filters and table with Segment row semantics", async () => {
    vi.mocked(fetchAuditLogs).mockResolvedValue({
      items: [auditLog],
      totalCount: 1,
    })

    renderHistory()

    const summaryComment = await screen.findByText(auditLog.comment)
    expect(summaryComment).toHaveClass("inline-block", "max-w-full")
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent)
    ).toEqual(["", "Date", "User", "Event", "Comment"])
    expect(screen.getByText("Updated settings")).toBeInTheDocument()
    expect(screen.getByText("Changed name")).toHaveClass(
      "inline-block",
      "truncate"
    )

    await waitFor(() =>
      expect(fetchAuditLogs).toHaveBeenCalledWith(
        "env-1",
        expect.objectContaining({
          refType: "Segment",
          refId: segment.id,
          crossEnvironment: false,
        }),
        0,
        10
      )
    )

    expect(
      screen.queryByRole("button", { name: "Clear filters" })
    ).not.toBeInTheDocument()
    const search = screen.getByPlaceholderText("Filter by key or comment")
    fireEvent.change(search, { target: { value: "release" } })
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(search).toHaveValue("")
    expect(
      screen.queryByRole("button", { name: "Clear filters" })
    ).not.toBeInTheDocument()

    const expandButton = screen.getByRole("button", {
      name: "Expand audit log",
    })
    fireEvent.click(summaryComment)

    expect(screen.getAllByText(auditLog.comment)).toHaveLength(2)
    expect(screen.getByText("Changes")).toBeInTheDocument()
    expect(expandButton).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(expandButton)

    expect(screen.getAllByText(auditLog.comment)).toHaveLength(1)
    expect(expandButton).toHaveAttribute("aria-expanded", "false")
  })

  it("keeps shared Segment history scoped across environments", async () => {
    vi.mocked(fetchAuditLogs).mockResolvedValue({ items: [], totalCount: 0 })
    const sharedSegment: Segment = {
      ...segment,
      type: "shared",
      scopes: ["env-1", "env-2"],
    }

    renderHistory(sharedSegment)

    expect(await screen.findByText("Across 2 scopes")).toBeInTheDocument()
    await waitFor(() =>
      expect(fetchAuditLogs).toHaveBeenCalledWith(
        "env-1",
        expect.objectContaining({ crossEnvironment: true }),
        0,
        10
      )
    )
  })
})
