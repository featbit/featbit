import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import type { AuditLog } from "../audit-logs-types"
import type { AuditLogTableAdapter } from "./audit-log-table-adapter"
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
    expect(screen.getByText("Changes").closest("tr")).toHaveClass(
      "bg-muted/20",
      "hover:bg-muted/20"
    )
    expect(screen.getByText("Changes").closest(".rounded-md")).toBeNull()
    expect(screen.getByText("Updated").closest(".max-w-3xl")).not.toBeNull()
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

  it("renders resource-specific event and change content from an adapter", () => {
    const adapter: AuditLogTableAdapter = {
      eventTitle: () => "Updated segment settings",
      eventSubtitle: () => "Changed segment name",
      changeDetails: () => ({
        count: 1,
        content: <p>Segment-specific change</p>,
      }),
    }

    render(
      <MemoryRouter>
        <TooltipProvider>
          <AuditLogTable
            items={[{ ...auditLog, refType: "Segment" }]}
            lang="en"
            locale="en"
            loading={false}
            filtered={false}
            resourceScoped
            adapter={adapter}
            onClearFilters={vi.fn()}
            onViewRawData={vi.fn()}
          />
        </TooltipProvider>
      </MemoryRouter>
    )

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent)
    ).toEqual(["", "Date", "User", "Event", "Comment"])
    expect(screen.getByText("Updated segment settings")).toBeInTheDocument()
    expect(screen.getByText("Changed segment name")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Expand audit log" }))

    expect(screen.getByText("1 change")).toBeInTheDocument()
    expect(screen.getByText("Segment-specific change")).toBeInTheDocument()
  })

  it("shows a decision detail instead of an empty semantic change ledger", () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <AuditLogTable
            items={[
              {
                ...auditLog,
                operation: "DeclineFlagChangeRequest",
                comment: "Needs a rollback plan.",
                instructions: [],
              },
            ]}
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

    expect(screen.getByText("Declined change request")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Expand audit log" }))

    expect(screen.getByText("Decision")).toBeInTheDocument()
    expect(screen.queryByText("No semantic changes available.")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "View raw data" })
    ).not.toBeInTheDocument()
    expect(screen.getAllByText("Needs a rollback plan.")).toHaveLength(2)
  })

  it("shows the snapshotted request context and targeting link", () => {
    const onViewRawData = vi.fn()
    const baseFlag = {
      id: "flag-1",
      name: "Checkout redesign",
      key: "checkout-redesign",
      description: "",
      isEnabled: true,
      isArchived: false,
      variationType: "boolean",
      variations: [
        { id: "on", name: "Enabled", value: "true" },
        { id: "off", name: "Disabled", value: "false" },
      ],
      disabledVariationId: "off",
      targetUsers: [],
      rules: [],
      fallthrough: {
        variations: [{ id: "on", rollout: [0, 1] }],
        dispatchKey: "keyId",
      },
      tags: [],
    }
    const decisionSnapshot = JSON.stringify({
      id: "flag-1",
      name: "Checkout redesign",
      key: "checkout-redesign",
      changeRequestId: "request-1",
      requestComment: "Roll out after QA approval.",
      proposedDataChange: {
        previous: JSON.stringify(baseFlag),
        current: JSON.stringify({
          ...baseFlag,
          fallthrough: {
            ...baseFlag.fallthrough,
            variations: [{ id: "off", rollout: [0, 1] }],
          },
        }),
      },
    })

    render(
      <MemoryRouter>
        <TooltipProvider>
          <AuditLogTable
            items={[
              {
                ...auditLog,
                operation: "ApproveFlagChangeRequest",
                comment: "Looks good.",
                dataChange: {
                  previous: decisionSnapshot,
                  current: decisionSnapshot,
                },
                instructions: [],
              },
            ]}
            lang="en"
            locale="en"
            loading={false}
            filtered={false}
            onClearFilters={vi.fn()}
            onViewRawData={onViewRawData}
          />
        </TooltipProvider>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: "Expand audit log" }))

    expect(screen.getByText("Request comment")).toBeInTheDocument()
    expect(screen.getByText("Reviewer comment")).toBeInTheDocument()
    expect(screen.getByText("Roll out after QA approval.")).toBeInTheDocument()
    expect(screen.getByText("Targeting changes")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "View change request" })
    ).toHaveAttribute("href", "/en/change-requests?changeRequestId=request-1")
    expect(
      screen.getByRole("link", { name: "View change request" })
    ).toHaveAttribute("target", "_blank")
    expect(
      screen.getByRole("link", { name: "View change request" })
    ).toHaveAttribute("rel", "noopener noreferrer")
    expect(
      screen.getByRole("link", { name: "View change request" }).firstChild
    ).toHaveClass("translate-y-px")
    fireEvent.click(screen.getByRole("button", { name: "View raw data" }))
    expect(
      screen.getByRole("button", { name: "View raw data" }).firstChild
    ).toHaveClass("translate-y-px")
    expect(onViewRawData).toHaveBeenCalledOnce()
    expect(onViewRawData.mock.calls[0]?.[0]).toMatchObject({
      operation: "ApproveFlagChangeRequest",
      dataChange: JSON.parse(decisionSnapshot).proposedDataChange,
    })
  })
})
