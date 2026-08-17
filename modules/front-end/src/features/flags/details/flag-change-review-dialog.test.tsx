import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FlagChangeReviewDialog } from "./flag-change-review-dialog"

describe("FlagChangeReviewDialog save options", () => {
  it("uses a split save button with only schedule and approval alternatives", async () => {
    const onSave = vi.fn()
    const onSchedule = vi.fn()
    const onChangeRequest = vi.fn()
    render(
      <FlagChangeReviewDialog
        open
        flagName="Checkout redesign"
        changes={[
          { kind: "default", label: "Default rule", action: "updated" },
        ]}
        requireComment={false}
        saving={false}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onSchedule={onSchedule}
        onChangeRequest={onChangeRequest}
      />
    )

    const flagName = screen.getByText("Checkout redesign")
    expect(flagName.tagName).toBe("STRONG")
    expect(flagName).toHaveClass("font-semibold", "text-foreground")

    fireEvent.change(screen.getByLabelText(/Change comment/), {
      target: { value: "Coordinate with support" },
    })
    fireEvent.click(screen.getByRole("button", { name: "More save options" }))

    await waitFor(() =>
      expect(screen.getByText("Apply immediately")).toBeVisible()
    )
    expect(
      document.querySelector('[data-slot="review-save-options-positioner"]')
    ).toHaveClass("z-[60]")
    expect(screen.getByText("Schedule changes")).toBeVisible()
    expect(
      screen.getByText("Schedule changes").closest('[role="menuitem"]')
    ).toHaveClass("[&_svg]:size-4", "[&_svg]:shrink-0")
    expect(screen.getByText("Request approval")).toBeVisible()
    expect(screen.queryByText(/Schedule with approval/)).not.toBeInTheDocument()
    expect(screen.queryByText(/changes…/)).not.toBeInTheDocument()
    expect(screen.queryByText(/approval…/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Schedule changes"))
    expect(onSchedule).toHaveBeenCalledWith("Coordinate with support")

    fireEvent.click(screen.getByRole("button", { name: "More save options" }))
    await waitFor(() =>
      expect(screen.getByText("Request approval")).toBeVisible()
    )
    fireEvent.click(screen.getByText("Request approval"))
    expect(onChangeRequest).toHaveBeenCalledWith("Coordinate with support")
  })

  it("keeps all save paths disabled when there are no changes", async () => {
    const onSave = vi.fn()
    render(
      <FlagChangeReviewDialog
        open
        flagName="Checkout redesign"
        changes={[]}
        requireComment={false}
        saving={false}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onSchedule={vi.fn()}
        onChangeRequest={vi.fn()}
      />
    )

    const save = screen.getByRole("button", { name: "Save changes" })
    expect(save).toHaveClass("rounded-r-none", "border-r-0")
    expect(save.parentElement).toHaveAttribute("data-slot", "review-save-split")
    expect(save).toBeDisabled()

    fireEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "More save options" }))
    for (const label of [
      "Apply immediately",
      "Schedule changes",
      "Request approval",
    ]) {
      expect(
        (await screen.findByText(label)).closest('[role="menuitem"]')
      ).toHaveAttribute("aria-disabled", "true")
    }
  })

  it("restores the submission reason when returning to review", () => {
    render(
      <FlagChangeReviewDialog
        open
        flagName="Checkout redesign"
        changes={[]}
        requireComment={false}
        saving={false}
        initialComment="Coordinate with support"
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onSchedule={vi.fn()}
        onChangeRequest={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/Change comment/)).toHaveValue(
      "Coordinate with support"
    )
  })
})
import "@/lib/i18n/i18n"
