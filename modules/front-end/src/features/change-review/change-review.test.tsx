import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { ChangeReviewDialog } from "./change-review-dialog"
import { ChangeLedger, type ChangeLedgerCopy } from "./change-ledger"
import type { ChangeReviewItem } from "./change-review-types"

const ledgerCopy: ChangeLedgerCopy<ChangeReviewItem> = {
  label: (change) => change.label,
  action: (action) => action,
  actionCount: (action, count) => `${action} · ${count}`,
  showMore: (count) => `Show ${count} more`,
  showLess: "Show less",
}

const dialogCopy = {
  title: "Review flag settings",
  description: "Review this feature flag before saving.",
  changes: "Changes",
  changeCount: (count: number) => `${count} change`,
  comment: "Change comment",
  optional: "(optional)",
  commentPlaceholder: "Explain this change",
  commentHelp: "Saved to the audit log.",
  cancel: "Cancel",
  save: "Save changes",
  saving: "Saving...",
}

const changes: ChangeReviewItem[] = [
  {
    kind: "field",
    label: "Flag name",
    action: "updated",
    previous: "Checkout",
    current: "Checkout v2",
  },
]

describe("shared change review", () => {
  it("uses compact spacing between ledger items without changing internal groups", () => {
    const { container } = render(
      <ChangeLedger
        layout="settings"
        copy={ledgerCopy}
        changes={[
          ...changes,
          {
            kind: "tags",
            label: "Tags",
            valueGroups: [
              { action: "added", values: ["release"] },
              { action: "removed", values: ["legacy"] },
            ],
          },
        ]}
      />
    )

    const ledger = container.firstElementChild
    expect(ledger).toHaveClass("space-y-0")
    expect(ledger?.children[0]).toHaveClass("py-2")
    expect(ledger?.children[1]).toHaveClass("py-2")
    expect(ledger?.children[1].children[1]).toHaveClass("space-y-2")
  })

  it("renders consumer-provided copy and enforces a required comment", () => {
    const onSave = vi.fn()
    render(
      <ChangeReviewDialog
        open
        idPrefix="feature-flag-settings"
        layout="settings"
        changes={changes}
        requireComment
        saving={false}
        copy={dialogCopy}
        ledger={{ copy: ledgerCopy }}
        onOpenChange={vi.fn()}
        onSave={onSave}
      />
    )

    expect(screen.getByText("Review flag settings")).toBeVisible()
    const save = screen.getByRole("button", { name: "Save changes" })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Change comment/), {
      target: { value: "Required for release tracking" },
    })
    fireEvent.click(save)

    expect(onSave).toHaveBeenCalledWith("Required for release tracking")
  })

  it("keeps save disabled when there are no changes", () => {
    const onSave = vi.fn()
    render(
      <ChangeReviewDialog
        open
        idPrefix="feature-flag-settings"
        layout="settings"
        changes={[]}
        requireComment={false}
        saving={false}
        saveDisabled
        copy={dialogCopy}
        ledger={{ copy: ledgerCopy }}
        onOpenChange={vi.fn()}
        onSave={onSave}
      />
    )

    const save = screen.getByRole("button", { name: "Save changes" })
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
  })

  it("clears the comment after a parent-controlled save closes the dialog", () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open review
          </button>
          <ChangeReviewDialog
            open={open}
            idPrefix="segment-settings"
            layout="settings"
            changes={changes}
            requireComment={false}
            saving={false}
            copy={dialogCopy}
            ledger={{ copy: ledgerCopy }}
            onOpenChange={setOpen}
            onSave={() => setOpen(false)}
          />
        </>
      )
    }

    render(<Harness />)
    fireEvent.change(screen.getByLabelText(/Change comment/), {
      target: { value: "First save comment" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    fireEvent.click(screen.getByRole("button", { name: "Open review" }))

    expect(screen.getByLabelText(/Change comment/)).toHaveValue("")
  })
})
