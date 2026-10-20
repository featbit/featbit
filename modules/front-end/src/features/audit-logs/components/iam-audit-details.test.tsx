import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n/i18n"
import type { AuditLog } from "../audit-logs-types"
import { IamAuditDetails } from "./iam-audit-details"

function log(operation: string, previous: object, current: object): AuditLog {
  return {
    id: "audit",
    refId: "resource",
    refType: "Group",
    operation,
    creatorId: "actor",
    creatorName: "Actor",
    creatorEmail: "",
    createdAt: "2026-10-20T10:00:00Z",
    comment: "",
    instructions: [],
    dataChange: {
      previous: JSON.stringify(previous),
      current: JSON.stringify(current),
    },
  }
}

describe("IAM reference collections", () => {
  for (const field of ["members", "groups", "policies"]) {
    const references = ["First", "Second", "Third"].map((name) => ({
      id: name,
      name,
      rn: `${field}/${name.toLowerCase()}`,
    }))

    it.each(["Create", "Clone", "Delete"])(
      `renders ${field} as separate identities for %s with expandable overflow`,
      (operation) => {
        const snapshot = { [field]: references }
        render(
          <IamAuditDetails
            log={log(
              operation,
              operation === "Delete" ? snapshot : {},
              operation === "Delete" ? {} : snapshot
            )}
          />
        )
        const items = screen.getAllByRole("listitem")
        expect(items).toHaveLength(2)
        expect(within(items[0]).getByText("First")).toBeInTheDocument()
        expect(within(items[0]).getByText(`${field}/first`)).toHaveClass(
          "font-mono",
          "text-xs",
          "text-muted-foreground"
        )
        expect(screen.queryByText("Third")).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Show 1 more" }))
        expect(screen.getAllByRole("listitem")).toHaveLength(3)
        expect(screen.getByText("Third")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Show less" }))
        expect(screen.queryByText("Third")).not.toBeInTheDocument()
      }
    )

    it(`keeps added and removed ${field} identities distinct in updates`, () => {
      render(
        <IamAuditDetails
          log={log(
            "Update",
            { [field]: [references[0]] },
            { [field]: [references[1]] }
          )}
        />
      )
      expect(screen.getByText("Removed")).toBeInTheDocument()
      expect(screen.getByText("Added")).toBeInTheDocument()
      for (const reference of references.slice(0, 2)) {
        const name = screen.getByText(reference.name)
        expect(within(name.parentElement!).getByText(reference.rn)).toHaveClass(
          "font-mono",
          "text-xs",
          "text-muted-foreground"
        )
      }
    })
  }
})
