import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { changeRequestsCopy } from "../change-requests-copy"
import type { ChangeRequestItem } from "../change-requests-types"
import { ChangeRequestTable } from "./change-request-table"

const reviewableRequest: ChangeRequestItem = {
  id: "request-1",
  flagId: "flag-1",
  flagName: "Checkout V2",
  flagKey: "checkout-v2",
  reason: "Ready for review after QA sign-off.",
  status: "PendingReview",
  creatorId: "author-1",
  creatorName: "Maya Chen",
  creatorEmail: "maya@example.com",
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-28T08:05:00.000Z",
  dataChange: {},
  instructions: [{ kind: "UpdateDefaultVariation", value: "true" }],
  reviewers: [
    {
      memberId: "current-user",
      name: "Alex Reviewer",
      email: "alex@example.com",
      action: "",
    },
  ],
  canReview: true,
  canApply: false,
}

const applicableRequest: ChangeRequestItem = {
  ...reviewableRequest,
  id: "request-2",
  reason: "Increase mobile rollout to 50%.",
  status: "Approved",
  canReview: false,
  canApply: true,
}

const observerRequest: ChangeRequestItem = {
  ...reviewableRequest,
  id: "request-3",
  canReview: false,
  canApply: false,
}

describe("ChangeRequestTable", () => {
  it("prioritizes an assigned review, expands its targeting changes, and exposes decisions", () => {
    const onAction = vi.fn()
    render(
      <MemoryRouter>
        <ChangeRequestTable
          items={[reviewableRequest, applicableRequest]}
          lang="en"
          locale="en-US"
          envName="Production"
          currentUserId="current-user"
          loading={false}
          filtered={false}
          acting={null}
          copy={changeRequestsCopy("en")}
          onAction={onAction}
          onClearFilters={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getAllByText("You")).toHaveLength(2)
    expect(
      screen.getByRole("button", { name: "Collapse change request" })
    ).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Targeting changes")).toBeInTheDocument()
    const targetingLink = screen.getByRole("link", {
      name: "View in targeting",
    })
    expect(targetingLink).toHaveAttribute(
      "href",
      "/en/feature-flags/checkout-v2/targeting?changeRequestId=request-1&mode=preview"
    )
    expect(targetingLink).toHaveAttribute("target", "_blank")
    expect(targetingLink).toHaveAttribute("rel", "noopener noreferrer")
    expect(
      screen
        .getAllByText("Maya Chen")[0]
        ?.closest("td")
        ?.querySelector('[aria-hidden="true"]')
    ).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    expect(onAction).toHaveBeenCalledWith(reviewableRequest, "approve")
    expect(screen.getAllByRole("button", { name: "Decline" })).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }))
    expect(onAction).toHaveBeenCalledWith(applicableRequest, "apply")
  })

  it("keeps targeting navigation in the expanded details", () => {
    render(
      <MemoryRouter>
        <ChangeRequestTable
          items={[observerRequest]}
          lang="en"
          locale="en-US"
          envName="Production"
          currentUserId="current-user"
          loading={false}
          filtered={false}
          acting={null}
          copy={changeRequestsCopy("en")}
          onAction={vi.fn()}
          onClearFilters={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(
      screen.queryByRole("link", { name: "View", exact: true })
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Expand change request" })
    )

    const targetingLink = screen.getByRole("link", {
      name: "View in targeting",
    })
    expect(targetingLink).toHaveAttribute("target", "_blank")
    expect(targetingLink).toHaveAttribute(
      "href",
      "/en/feature-flags/checkout-v2/targeting?changeRequestId=request-3&mode=preview"
    )
  })
})
