import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import type { PendingFlagChange } from "../../flags-types"
import { PendingChangesSheet } from "./pending-changes-sheet"

vi.mock("@/features/auth/auth-api", () => ({
  getStoredUserProfile: vi.fn(),
}))

const reviewItem: PendingFlagChange = {
  id: "schedule-1",
  type: "Schedule",
  status: "PendingReview",
  flagId: "flag-1",
  creatorId: "creator-1",
  creatorName: "Priya Shah",
  createdAt: "2026-07-26T12:32:00.000Z",
  dataChange: {
    previous: JSON.stringify({
      variations: [
        { id: "variation-a", name: "Variation A", value: "A" },
        { id: "variation-b", name: "Variation B", value: "B" },
      ],
      targetUsers: [],
      rules: [],
      fallthrough: {
        variations: [{ id: "variation-a", rollout: [0, 1] }],
        dispatchKey: "keyId",
      },
      disabledVariationId: "variation-a",
    }),
    current: JSON.stringify({
      variations: [
        { id: "variation-a", name: "Variation A", value: "A" },
        { id: "variation-b", name: "Variation B", value: "B" },
      ],
      targetUsers: [{ variationId: "variation-b", keyIds: ["user-1"] }],
      rules: [],
      fallthrough: {
        variations: [{ id: "variation-b", rollout: [0, 1] }],
        dispatchKey: "keyId",
      },
      disabledVariationId: "variation-a",
    }),
  },
  instructions: [],
  scheduleTitle: "Expand checkout rollout",
  scheduledTime: "2026-07-29T08:00:00.000Z",
  changeRequestId: "request-1",
  changeRequestReason: "Roll out after the production deployment.",
  reviewers: [
    {
      memberId: "current-user",
      name: "Emma Wilson",
      email: "emma@example.com",
      action: "",
      timestamp: "",
    },
    {
      memberId: "reviewer-2",
      name: "Liam Chen",
      email: "liam@example.com",
      action: "Approve",
      timestamp: "",
    },
  ],
}

const approvedItem: PendingFlagChange = {
  id: "request-2",
  type: "ChangeRequest",
  status: "Approved",
  flagId: "flag-1",
  creatorId: "current-user",
  creatorName: "Emma Wilson",
  createdAt: "2026-07-25T07:18:00.000Z",
  dataChange: {},
  instructions: [{ kind: "UpdateDefaultRule", value: "New checkout" }],
  changeRequestReason: "Increase exposure after internal validation.",
  reviewers: [
    {
      memberId: "reviewer-2",
      name: "Liam Chen",
      email: "liam@example.com",
      action: "Approve",
      timestamp: "",
    },
  ],
}

function renderSheet(onAction = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <PendingChangesSheet
        open
        flagName="Checkout redesign"
        items={[reviewItem, approvedItem]}
        loading={false}
        failed={false}
        removingId={null}
        acting={null}
        onOpenChange={vi.fn()}
        onRetry={vi.fn()}
        onRemove={vi.fn()}
        onAction={onAction}
      />
    </QueryClientProvider>
  )
}

describe("pending changes sheet", () => {
  beforeEach(() => {
    vi.mocked(getStoredUserProfile).mockReturnValue({ id: "current-user" })
  })

  it("matches the approved queue hierarchy and exposes workflow actions", async () => {
    const onAction = vi.fn()
    renderSheet(onAction)

    expect(screen.getByText("Pending changes")).toBeVisible()
    expect(
      screen.getByText(
        "Review scheduled changes and approval requests for Checkout redesign."
      )
    ).toBeVisible()
    expect(
      screen.getByText("2 pending changes · 1 needs your review")
    ).toBeVisible()
    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveClass(
      "sm:!max-w-[760px]"
    )
    expect(document.querySelector(".divide-y.rounded-lg.border")).toBeTruthy()

    expect(screen.getByText("Default")).toBeVisible()
    expect(screen.getByText("User")).toBeVisible()
    expect(screen.getByText("Serve")).toBeVisible()
    expect(screen.getAllByText("Variation B").length).toBeGreaterThan(0)
    expect(screen.getByText("user-1")).toBeVisible()
    expect(
      screen.getByText(/Emma Wilson \(emma@example.com\) · Pending/)
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Decline" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Approve" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Apply changes" })).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    expect(onAction).toHaveBeenCalledWith(reviewItem, "approve")
  })

  it("renders list-row skeletons while loading", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <PendingChangesSheet
          open
          flagName="Checkout redesign"
          items={[]}
          loading
          failed={false}
          removingId={null}
          acting={null}
          onOpenChange={vi.fn()}
          onRetry={vi.fn()}
          onRemove={vi.fn()}
          onAction={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(18)
  })

  it("opens the remove confirmation directly from each card", () => {
    renderSheet()

    const removeButtons = screen.getAllByRole("button", { name: "Remove" })
    expect(removeButtons).toHaveLength(2)

    fireEvent.click(removeButtons[0])

    const confirmDialog = screen.getByRole("dialog", {
      name: "Remove pending change?",
    })
    expect(confirmDialog).toBeVisible()
    expect(confirmDialog.querySelector("strong")).toHaveTextContent(
      "Expand checkout rollout"
    )
  })
})
