import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  fetchSegmentAuditLogs,
  fetchSegmentTeamMembers,
} from "../../segments-api"
import type { AuditLog, Segment } from "../../segments-types"
import { HistoryTab } from "./history-tab"

vi.mock("../../segments-api", () => ({
  fetchSegmentAuditLogs: vi.fn(),
  fetchSegmentTeamMembers: vi.fn(),
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
  instructions: [{ kind: "UpdateSegmentName", value: "After" }],
}

describe("HistoryTab comments", () => {
  it("shows the comment in the summary and expanded details", async () => {
    vi.mocked(fetchSegmentAuditLogs).mockResolvedValue({
      items: [auditLog],
      totalCount: 1,
    })
    vi.mocked(fetchSegmentTeamMembers).mockResolvedValue({
      items: [],
      totalCount: 0,
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <HistoryTab envId="env-1" segment={segment} />
      </QueryClientProvider>
    )

    const summaryComment = await screen.findByText(auditLog.comment)
    expect(summaryComment).toHaveClass("inline-block", "max-w-full")

    fireEvent.click(
      screen.getByRole("button", {
        name: "segments.detailsPage.history.expand",
      })
    )

    expect(screen.getAllByText(auditLog.comment)).toHaveLength(2)
  })
})
