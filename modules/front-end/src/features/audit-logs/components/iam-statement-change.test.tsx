import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import type { AuditLog } from "../audit-logs-types"
import { iamStatementChanges } from "../iam-audit-changes"
import { AuditLogTable } from "./audit-log-table"

const statement = {
  id: "statement-1",
  resourceType: "access-token",
  effect: "allow",
  resources: ["access-token/*"],
  actions: ["ListAccessTokens", "ManagePersonalAccessTokens"],
}
function log(
  previous: (typeof statement)[],
  current: (typeof statement)[]
): AuditLog {
  return {
    id: "audit",
    refId: "policy",
    refType: "Policy",
    operation: "UpdatePolicyStatements",
    creatorId: "actor",
    creatorName: "Actor",
    creatorEmail: "",
    createdAt: "2026-10-20T10:00:00Z",
    comment: "",
    instructions: [],
    dataChange: {
      previous: JSON.stringify({ statements: previous }),
      current: JSON.stringify({ statements: current }),
    },
  }
}
function renderLog(item: AuditLog) {
  render(
    <MemoryRouter>
      <TooltipProvider>
        <AuditLogTable
          items={[item]}
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
}

describe("IAM statement audit groups", () => {
  it.each(["added", "removed"] as const)(
    "counts an %s statement once and renders its full configuration",
    (action) => {
      renderLog(
        log(
          action === "added" ? [] : [statement],
          action === "added" ? [statement] : []
        )
      )
      expect(screen.getAllByText(`1 statement ${action}`)).toHaveLength(2)
      expect(screen.queryByText("4 changes")).not.toBeInTheDocument()
      expect(screen.getByText("Permission statement 1")).toBeInTheDocument()
      expect(screen.getByText("Access token")).toBeInTheDocument()
      expect(screen.getByText("Allow")).toBeInTheDocument()
      expect(
        screen.getAllByText(action === "added" ? "Added" : "Removed")
      ).toHaveLength(1)
      expect(screen.queryByText(statement.id)).not.toBeInTheDocument()
      expect(screen.getByText("access-token/*")).toBeInTheDocument()
    }
  )

  it("groups mixed changes and shows only set additions/removals for updates", () => {
    const updated = {
      ...statement,
      actions: ["ListAccessTokens", "ManageServiceAccessTokens"],
    }
    const removed = { ...statement, id: "statement-2" }
    const added = { ...statement, id: "statement-3" }
    renderLog(log([statement, removed], [updated, added]))
    expect(
      screen.getAllByText(
        "1 statement added · 1 statement removed · 1 statement updated"
      )
    ).toHaveLength(2)
    const section = screen
      .getByText("Permission statement 1")
      .closest("section")!
    const group = within(section)
    expect(group.getByText("Actions")).toBeInTheDocument()
    expect(group.queryByText("Resource type")).not.toBeInTheDocument()
    expect(group.queryByText("Resources")).not.toBeInTheDocument()
    expect(group.getByText("Removed · 1")).toBeInTheDocument()
    expect(group.getByText("Added · 1")).toBeInTheDocument()
    expect(group.queryByText("List access tokens")).not.toBeInTheDocument()
  })

  it("ignores statement order and action/resource set order or duplicates", () => {
    const second = { ...statement, id: "statement-2" }
    expect(
      iamStatementChanges(
        log(
          [statement, second],
          [
            second,
            {
              ...statement,
              actions: [...statement.actions]
                .reverse()
                .concat(statement.actions[0]),
            },
          ]
        )
      )
    ).toEqual([])
  })

  it("hides statement identifiers and keeps raw data accessible", () => {
    renderLog(log([], [statement]))
    expect(screen.queryByText("Statement ID")).not.toBeInTheDocument()
    expect(screen.queryByText(statement.id)).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "View raw data" })
    ).toBeInTheDocument()
  })
})
