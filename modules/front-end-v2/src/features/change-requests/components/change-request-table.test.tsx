import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import { changeRequestsCopy } from "../change-requests-copy"
import type { ChangeRequestItem } from "../change-requests-types"
import { ChangeRequestTable } from "./change-request-table"

const reviewableRequest: ChangeRequestItem = {
  id: "request-1",
  flagId: "flag-1",
  flagName: "Checkout V2",
  flagKey: "checkout-v2",
  scopeRn: "project/game-runner:env/dev",
  reason: "Ready for review after QA sign-off.",
  status: "PendingReview",
  creatorId: "author-1",
  creatorName: "Maya Chen",
  creatorEmail: "maya@example.com",
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-28T08:05:00.000Z",
  updatorId: "updater-1",
  updatorName: "Jordan Lee",
  updatorEmail: "jordan@example.com",
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
  scopeRn: "project/game-runner:env/production",
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
  it("prioritizes an assigned review, expands its targeting changes, and exposes decisions", async () => {
    const onAction = vi.fn()
    const onCopyKey = vi.fn()
    render(
      <MemoryRouter>
        <TooltipProvider>
          <ChangeRequestTable
            items={[reviewableRequest, applicableRequest]}
            lang="en"
            currentUserId="current-user"
            loading={false}
            filtered={false}
            acting={null}
            copy={changeRequestsCopy("en")}
            onAction={onAction}
            onCopyKey={onCopyKey}
            onClearFilters={vi.fn()}
          />
        </TooltipProvider>
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
      screen.queryByRole("columnheader", { name: "Author" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Last change" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Scope" })
    ).toBeInTheDocument()
    const scopeCell = screen
      .getAllByText("project/game-runner:env/dev")[0]
      ?.closest("td")
    expect(scopeCell).not.toBeNull()
    expect(scopeCell?.querySelector(".lucide-box")).not.toBeNull()
    expect(
      screen.getByText("project/game-runner:env/production")
    ).toBeInTheDocument()
    const requestCell = screen
      .getByText("Ready for review after QA sign-off.")
      .closest("td")
    expect(requestCell).not.toBeNull()
    expect(within(requestCell!).getByText("Created by")).toBeInTheDocument()
    const creatorLink = within(requestCell!).getByRole("link", {
      name: "Maya Chen",
    })
    expect(creatorLink).toHaveAttribute(
      "href",
      "/en/iam/team/author-1/permissions"
    )
    expect(creatorLink).toHaveAttribute("target", "_blank")
    expect(creatorLink).toHaveAttribute("rel", "noopener noreferrer")
    fireEvent.mouseEnter(creatorLink)
    expect(await screen.findByText("maya@example.com")).toBeInTheDocument()
    expect(within(requestCell!).getByText("· Jul 28, 2026")).toBeInTheDocument()
    expect(
      within(requestCell!).queryByText("Checkout V2")
    ).not.toBeInTheDocument()
    expect(
      within(requestCell!).queryByText("Production")
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(requestCell!).getByRole("button", {
        name: "Copy flag key checkout-v2",
      })
    )
    expect(onCopyKey).toHaveBeenCalledWith("checkout-v2")
    expect(requestCell?.querySelector(".rounded-full")).toBeNull()

    const lastChange = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(reviewableRequest.updatedAt))
    const lastChangeCell = screen.getAllByText(lastChange)[0]?.closest("td")
    expect(lastChangeCell).not.toBeNull()
    expect(within(lastChangeCell!).getByText("Updated by")).toBeInTheDocument()
    const updaterLink = within(lastChangeCell!).getByRole("link", {
      name: "Jordan Lee",
    })
    expect(updaterLink).toHaveAttribute(
      "href",
      "/en/iam/team/updater-1/permissions"
    )
    expect(updaterLink).toHaveAttribute("target", "_blank")
    fireEvent.mouseLeave(creatorLink)
    fireEvent.mouseEnter(updaterLink)
    expect(await screen.findByText("jordan@example.com")).toBeInTheDocument()

    const reviewerLink = screen.getAllByRole("link", { name: "You" })[0]
    expect(reviewerLink).toHaveAttribute(
      "href",
      "/en/iam/team/current-user/permissions"
    )
    expect(reviewerLink).toHaveAttribute("target", "_blank")
    fireEvent.mouseLeave(updaterLink)
    fireEvent.mouseEnter(reviewerLink)
    expect(await screen.findByText("alex@example.com")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    expect(onAction).toHaveBeenCalledWith(reviewableRequest, "approve")
    expect(screen.getAllByRole("button", { name: "Decline" })).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }))
    expect(onAction).toHaveBeenCalledWith(applicableRequest, "apply")
  })

  it("keeps targeting navigation in the expanded details", () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <ChangeRequestTable
            items={[observerRequest]}
            lang="en"
            currentUserId="current-user"
            loading={false}
            filtered={false}
            acting={null}
            copy={changeRequestsCopy("en")}
            onAction={vi.fn()}
            onCopyKey={vi.fn()}
            onClearFilters={vi.fn()}
          />
        </TooltipProvider>
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
