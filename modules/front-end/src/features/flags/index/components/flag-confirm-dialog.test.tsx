import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { FeatureFlag } from "../../flags-types"
import { FlagConfirmDialog } from "./flag-confirm-dialog"

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout redesign",
  key: "checkout-redesign",
  tags: [],
  isEnabled: true,
  createdAt: "2026-07-01T10:00:00Z",
  updatedAt: "2026-07-01T10:00:00Z",
  variationType: "boolean",
}

describe("FlagConfirmDialog", () => {
  it.each([true, false])(
    "accepts an optional comment when toggling to %s",
    (nextEnabled) => {
      const onConfirm = vi.fn()
      render(
        <FlagConfirmDialog
          target={{ kind: "toggle", flag, nextEnabled }}
          saving={false}
          requireComment={false}
          onOpenChange={vi.fn()}
          onConfirm={onConfirm}
        />
      )

      const comment = screen.getByRole("textbox", {
        name: /Change comment/,
      })
      const confirm = screen.getByRole("button", { name: "Confirm" })
      const key = screen.getByPlaceholderText("Feature flag key")
      expect(screen.getByText("(optional)")).toBeVisible()
      expect(comment).not.toBeRequired()
      expect(confirm).toBeDisabled()
      fireEvent.click(confirm)
      expect(onConfirm).not.toHaveBeenCalled()

      for (const value of [flag.name, flag.key.toUpperCase(), `${flag.key} `]) {
        fireEvent.change(key, { target: { value } })
        expect(confirm).toBeDisabled()
      }
      fireEvent.change(key, { target: { value: flag.key } })
      expect(confirm).toBeEnabled()
      fireEvent.click(confirm)
      expect(onConfirm).toHaveBeenLastCalledWith("")

      fireEvent.change(comment, { target: { value: "  Release approved  " } })
      fireEvent.click(confirm)
      expect(onConfirm).toHaveBeenLastCalledWith("Release approved")
    }
  )

  it.each([true, false])(
    "requires a non-blank comment when toggling to %s in a protected environment",
    (nextEnabled) => {
      const onConfirm = vi.fn()
      const props = {
        target: { kind: "toggle" as const, flag, nextEnabled },
        saving: false,
        requireComment: true,
        onOpenChange: vi.fn(),
        onConfirm,
      }
      const { rerender } = render(<FlagConfirmDialog {...props} />)

      const comment = screen.getByRole("textbox", { name: /Change comment/ })
      const confirm = screen.getByRole("button", { name: "Confirm" })
      const key = screen.getByPlaceholderText("Feature flag key")
      fireEvent.change(key, { target: { value: flag.key } })
      expect(comment).toBeRequired()
      expect(confirm).toBeDisabled()
      fireEvent.change(comment, { target: { value: " \n\t " } })
      expect(confirm).toBeDisabled()
      fireEvent.click(confirm)
      expect(onConfirm).not.toHaveBeenCalled()

      fireEvent.change(comment, { target: { value: "  Release approved  " } })
      expect(confirm).toBeEnabled()
      fireEvent.change(key, { target: { value: "" } })
      expect(confirm).toBeDisabled()
      fireEvent.change(key, { target: { value: flag.key } })
      fireEvent.click(confirm)
      expect(onConfirm).toHaveBeenCalledExactlyOnceWith("Release approved")

      rerender(<FlagConfirmDialog {...props} saving />)
      expect(comment).toBeDisabled()
      expect(key).toBeDisabled()
      expect(confirm).toBeDisabled()
    }
  )

  it("shows the archive flag key with the same code treatment as other lifecycle dialogs", () => {
    render(
      <FlagConfirmDialog
        target={{ kind: "archive", flag }}
        saving={false}
        requireComment={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    const key = screen.getAllByText("checkout-redesign")[0]
    expect(key).toHaveClass(
      "rounded",
      "bg-muted",
      "font-mono",
      "text-foreground"
    )
    expect(key.closest('[data-slot="alert-dialog-description"]')).not.toBeNull()
  })

  it("keeps dirty targeting separate and names the saved OFF variation", () => {
    render(
      <FlagConfirmDialog
        target={{
          kind: "toggle",
          flag,
          nextEnabled: false,
          hasUnsavedTargeting: true,
          savedOffVariation: "Control",
        }}
        saving={false}
        requireComment={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(
      screen.getByText(
        "Unsaved Targeting edits will not be applied by this status change."
      )
    ).toBeVisible()
    expect(
      screen.getByText("The currently saved OFF variation is Control.")
    ).toBeVisible()
  })
})
