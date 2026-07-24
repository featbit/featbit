import { fireEvent, render, screen } from "@testing-library/react"
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
    ).toEqual(["", "Date", "User", "Type", "Key / Name", "Event", "Comment"])
    expect(
      screen.getByRole("link", { name: "Checkout redesign" })
    ).toHaveAttribute("href", "/en/feature-flags/checkout-redesign/targeting")

    const expand = screen.getByRole("button", { name: "Expand audit log" })
    fireEvent.click(expand)

    expect(expand).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Changes")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "View raw data" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Increase rollout after QA")).toHaveLength(2)
  })
})
