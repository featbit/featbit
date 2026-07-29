import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import type { AuditLog } from "../audit-logs-types"
import { AuditLogTable } from "./audit-log-table"

const auditLog: AuditLog = {
  id: "audit-1",
  refId: "flag-1",
  refType: "FeatureFlag",
  operation: "Update",
  creatorId: "user-1",
  creatorName: "Alex Chen",
  creatorEmail: "alex@example.com",
  createdAt: "2026-07-24T08:15:00.000Z",
  comment: "Increase rollout after QA",
  dataChange: {
    previous: JSON.stringify({
      id: "flag-1",
      name: "Checkout redesign",
      key: "checkout-redesign",
    }),
    current: JSON.stringify({
      id: "flag-1",
      name: "Checkout redesign",
      key: "checkout-redesign",
    }),
  },
  instructions: [{ kind: "UpdateName", value: "Checkout redesign" }],
}

describe("AuditLogTable", () => {
  it("renders the global columns and reuses the expandable history ledger", () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <AuditLogTable
            items={[auditLog]}
            lang="en"
            locale="en"
            loading={false}
            filtered={false}
            onClearFilters={vi.fn()}
            onViewRawData={vi.fn()}
          />
        </TooltipProvider>
      </MemoryRouter>
    )

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent)
    ).toEqual(["", "Date", "User", "Type", "Name / Key", "Event", "Comment"])
    expect(
      screen.getByRole("link", { name: "Checkout redesign" })
    ).toHaveAttribute("href", "/en/feature-flags/checkout-redesign/targeting")
    expect(screen.getByText("checkout-redesign")).not.toHaveAttribute(
      "data-slot",
      "tooltip-trigger"
    )

    const expand = screen.getByRole("button", { name: "Expand audit log" })
    fireEvent.click(expand)

    expect(expand).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Changes")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "View raw data" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Increase rollout after QA")).toHaveLength(2)
  })

  it("keeps the Event and Comment tooltips above their cell content", async () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <AuditLogTable
            items={[auditLog]}
            lang="en"
            locale="en"
            loading={false}
            filtered={false}
            onClearFilters={vi.fn()}
            onViewRawData={vi.fn()}
          />
        </TooltipProvider>
      </MemoryRouter>
    )

    const eventTrigger = screen.getByText("Update Name")
    expect(eventTrigger).toHaveClass("inline-block", "max-w-full", "truncate")
    fireEvent.pointerEnter(eventTrigger, { pointerType: "mouse" })
    fireEvent.mouseEnter(eventTrigger)
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="tooltip-content"]')
      ).toHaveAttribute("data-side", "top")
    )

    fireEvent.pointerLeave(eventTrigger, { pointerType: "mouse" })
    fireEvent.mouseLeave(eventTrigger)
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="tooltip-content"]')
      ).not.toBeInTheDocument()
    )

    const commentTrigger = screen.getByText("Increase rollout after QA")
    fireEvent.pointerEnter(commentTrigger, { pointerType: "mouse" })
    fireEvent.mouseEnter(commentTrigger)
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="tooltip-content"]')
      ).toHaveAttribute("data-side", "top")
    )
  })
})
