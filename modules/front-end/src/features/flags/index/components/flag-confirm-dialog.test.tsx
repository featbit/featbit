import { render, screen } from "@testing-library/react"
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
