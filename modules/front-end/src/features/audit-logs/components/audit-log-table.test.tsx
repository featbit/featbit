import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import type { AuditLog } from "../audit-logs-types"
import type { AuditLogTableAdapter } from "./audit-log-table-adapter"
import { AuditLogTable } from "./audit-log-table"
import { useSegmentAuditLogAdapter } from "@/features/segments/details/history/segment-audit-log-adapter"

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
  it.each([
    ["FeatureFlag", "/en/feature-flags/checkout-redesign/targeting"],
    ["Segment", "/en/segments/flag-1/targeting"],
    ["Policy", null],
  ])("renders %s resource links without scope metadata", (refType, href) => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <AuditLogTable
            items={[{ ...auditLog, refType }]}
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
    const link = screen.queryByRole("link", { name: "Checkout redesign" })
    if (href) {
      expect(link).toHaveAttribute("href", href)
    } else {
      expect(link).not.toBeInTheDocument()
      expect(screen.getByText("Checkout redesign")).toBeInTheDocument()
    }
  })

  it.each([
    [
      "FeatureFlag",
      "Archive",
      false,
      true,
      "Archive status",
      "Active",
      "Archived",
    ],
    [
      "FeatureFlag",
      "Restore",
      true,
      false,
      "Archive status",
      "Archived",
      "Active",
    ],
    ["Segment", "Archive", false, true, "Archive status", "Active", "Archived"],
    ["Segment", "Restore", true, false, "Archive status", "Archived", "Active"],
    ["FeatureFlag", "Update", false, true, "Flag state", "OFF", "ON"],
    ["FeatureFlag", "Update", true, false, "Flag state", "ON", "OFF"],
  ] as const)(
    "renders %s %s as one state transition",
    (refType, operation, before, after, label, previous, current) => {
      const { result: segmentAdapter } = renderHook(useSegmentAuditLogAdapter)
      const field = operation === "Update" ? "isEnabled" : "isArchived"
      render(
        <MemoryRouter>
          <TooltipProvider>
            <AuditLogTable
              adapter={
                refType === "Segment" ? segmentAdapter.current : undefined
              }
              items={[
                {
                  ...auditLog,
                  refType,
                  operation,
                  dataChange: {
                    previous: JSON.stringify({
                      name: "Recorded",
                      [field]: before,
                    }),
                    current: JSON.stringify({
                      name: "Recorded",
                      [field]: after,
                    }),
                  },
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
      fireEvent.click(screen.getByRole("button", { name: "Expand audit log" }))
      const heading = screen.getByRole("heading", { name: "Status change" })
      const details = within(heading.closest("tr")!)
      expect(details.getByText(label)).toBeInTheDocument()
      expect(details.getByText(previous)).toBeInTheDocument()
      expect(details.getByText(current)).toBeInTheDocument()
      expect(details.queryByText("Updated")).not.toBeInTheDocument()
      expect(details.queryByText("1 change")).not.toBeInTheDocument()
      expect(
        heading.closest("tr")!.querySelector(".lucide-arrow-right")
      ).not.toBeNull()
    }
  )
  it.each([
    ["FeatureFlag", "Create", false],
    ["FeatureFlag", "Clone", false],
    ["FeatureFlag", "Remove", true],
    ["Segment", "Create", false],
    ["Segment", "Clone", false],
    ["Segment", "Remove", true],
    ["Group", "CreateGroup", false],
    ["Group", "Create", false],
    ["Group", "Clone", false],
    ["Group", "DeleteGroup", true],
    ["Policy", "ClonePolicy", false],
    ["Policy", "CreatePolicy", false],
    ["Policy", "Create", false],
    ["Policy", "Remove", true],
    ["Policy", "DeletePolicy", true],
    ["Member", "AddMember", false],
    ["Member", "Create", false],
    ["Member", "RemoveFromOrganization", true],
    ["Member", "RemoveFromWorkspace", true],
  ])(
    "shows %s %s as a snapshot without comparison actions",
    (refType, operation, deleted) => {
      const { result: segmentAdapter } = renderHook(useSegmentAuditLogAdapter)
      const snapshot = JSON.stringify({
        name: "Recorded name",
        key: "recorded-key",
        rn: "policy/recorded-key",
        isEnabled: false,
        variationType: "boolean",
        tags: ["first", "second", "third"],
        included: ["included-user"],
        excluded: [],
        rules: [
          {
            id: "rule-1",
            name: "Recorded rule",
            conditions: [
              {
                id: "condition-1",
                property: "country",
                op: "IsOneOf",
                value: '["France"]',
              },
            ],
            variations: [{ id: "yes", rollout: [0, 1] }],
          },
        ],
        variations: [
          { id: "yes", name: "Yes", value: "true" },
          { id: "no", name: "No", value: "false" },
        ],
        targetUsers: [{ variationId: "yes", keyIds: ["targeted-user"] }],
        fallthrough: { variations: [{ id: "yes", rollout: [0, 1] }] },
        disabledVariationId: "no",
        members: [{ id: "member-1", name: "Member Alice", rn: "member/alice" }],
        statements: [
          {
            id: "statement-1",
            effect: "allow",
            resourceType: "flag",
            resources: ["project/*"],
            actions: ["ToggleFlag"],
          },
        ],
      })
      render(
        <MemoryRouter>
          <TooltipProvider>
            <AuditLogTable
              adapter={
                refType === "Segment" ? segmentAdapter.current : undefined
              }
              items={[
                {
                  ...auditLog,
                  refType,
                  operation,
                  instructions: [],
                  dataChange: {
                    previous: deleted ? snapshot : "",
                    current: deleted ? "" : snapshot,
                    ...(operation === "ClonePolicy"
                      ? { clonedFrom: { id: "source-id", key: "source-key" } }
                      : {}),
                  },
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
      fireEvent.click(screen.getByRole("button", { name: "Expand audit log" }))
      const heading = screen.getByRole("heading", {
        name: deleted
          ? "Configuration before deletion"
          : "Initial configuration",
      })
      const eventRow = screen
        .getByRole("button", { name: "Collapse audit log" })
        .closest("tr")!
      expect(
        within(eventRow).queryByText("Initial configuration")
      ).not.toBeInTheDocument()
      expect(
        within(eventRow).queryByText("Configuration before deletion")
      ).not.toBeInTheDocument()
      const details = within(heading.closest("tr")!)
      expect(details.getByText("Recorded name")).toBeInTheDocument()
      expect(
        details.queryByText(/^(Added|Removed|Updated)( · \d+)?$/)
      ).not.toBeInTheDocument()
      expect(details.queryByText(/^\d+ changes$/)).not.toBeInTheDocument()
      expect(
        heading.closest("tr")!.querySelector(".lucide-arrow-down")
      ).toBeNull()
      if (refType === "FeatureFlag") {
        expect(details.getByText("Default serving")).toBeInTheDocument()
        expect(details.getByText("targeted-user")).toBeInTheDocument()
        expect(details.getByText("France")).toBeInTheDocument()
      }
      if (refType === "Segment") {
        expect(details.getByText("included-user")).toBeInTheDocument()
        expect(details.getByText("France")).toBeInTheDocument()
      }
      if (refType === "FeatureFlag" || refType === "Segment") {
        fireEvent.click(details.getByRole("button", { name: "Show 1 more" }))
        expect(details.getByText("first, second, third")).toBeInTheDocument()
      }
      if (operation === "ClonePolicy")
        expect(details.getByText("policy/source-key")).toBeInTheDocument()
    }
  )

  it.each([
    "AddGroupMember",
    "RemoveGroupMember",
    "AddGroupPolicy",
    "RemoveGroupPolicy",
  ])("keeps %s as a relationship comparison", (operation) => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <AuditLogTable
            items={[
              {
                ...auditLog,
                refType: "Group",
                operation,
                dataChange: {
                  previous: '{"name":"Before"}',
                  current: '{"name":"After"}',
                },
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
    fireEvent.click(screen.getByRole("button", { name: "Expand audit log" }))
    expect(screen.getByRole("heading", { name: "Changes" })).toBeInTheDocument()
    expect(screen.getByText("Updated")).toBeInTheDocument()
  })

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
    ).toEqual(["", "Date", "Actor", "Type", "Resource", "Operation", "Comment"])
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

  it("keeps the Operation and Comment tooltips above their cell content", async () => {
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
    ).toEqual(["", "Date", "Actor", "Operation", "Comment"])
    expect(screen.getByText("Updated segment settings")).toBeInTheDocument()
    expect(screen.getByText("Changed segment name")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Expand audit log" }))

    expect(screen.getByText("1 change")).toBeInTheDocument()
    expect(screen.getByText("Segment-specific change")).toBeInTheDocument()
  })

  it("shows segment names in feature flag history conditions", () => {
    const segmentId = "019f8b36-6360-7a19-a528-2b16f8d808b0"
    const historyLog = {
      ...auditLog,
      operation: "Create",
      dataChange: {
        current: JSON.stringify({
          id: "flag-1",
          name: "Checkout redesign",
          key: "checkout-redesign",
          variations: [],
          targetUsers: [],
          rules: [
            {
              id: "rule-1",
              name: "Rule 1",
              conditions: [
                {
                  id: "condition-1",
                  property: "User is in segment",
                  op: "",
                  value: JSON.stringify([segmentId]),
                },
              ],
              variations: [],
            },
          ],
        }),
      },
      instructions: [],
    }

    render(
      <MemoryRouter>
        <TooltipProvider>
          <AuditLogTable
            items={[historyLog]}
            segmentNames={new Map([[segmentId, "Enterprise customers"]])}
            lang="en"
            locale="en"
            loading={false}
            filtered={false}
            resourceScoped
            onClearFilters={vi.fn()}
            onViewRawData={vi.fn()}
          />
        </TooltipProvider>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: "Expand audit log" }))

    expect(screen.getByText("Enterprise customers")).toBeVisible()
    expect(screen.queryByText(segmentId)).not.toBeInTheDocument()
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
