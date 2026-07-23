import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChangeReviewDialog } from "./change-review-dialog"
import type { ChangeLedgerCopy } from "./change-ledger"
import type { ChangeReviewItem } from "./change-review-types"

const ledgerCopy: ChangeLedgerCopy<ChangeReviewItem> = {
  label: (change) => change.label,
  action: (action) => action,
  actionCount: (action, count) => `${action} · ${count}`,
  showMore: (count) => `Show ${count} more`,
  showLess: "Show less",
}

describe("shared change review", () => {
  it("renders consumer-provided copy and enforces a required comment", () => {
    const onSave = vi.fn()
    render(
      <ChangeReviewDialog
        open
        idPrefix="feature-flag-settings"
        layout="settings"
        changes={[
          {
            kind: "field",
            label: "Flag name",
            action: "updated",
            previous: "Checkout",
            current: "Checkout v2",
          },
        ]}
        requireComment
        saving={false}
        copy={{
          title: "Review flag settings",
          description: "Review this feature flag before saving.",
          changes: "Changes",
          changeCount: (count) => `${count} change`,
          comment: "Change comment",
          optional: "(optional)",
          commentPlaceholder: "Explain this change",
          commentHelp: "Saved to the audit log.",
          cancel: "Cancel",
          save: "Save changes",
          saving: "Saving...",
        }}
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
})
