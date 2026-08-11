import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { changeRequestsCopy } from "../change-requests-copy"
import { ChangeRequestDecisionDialog } from "./change-request-decision-dialog"

describe("ChangeRequestDecisionDialog", () => {
  it("allows approving without a comment", () => {
    const onConfirm = vi.fn()
    render(
      <ChangeRequestDecisionDialog
        action="approve"
        requestTitle="Raise checkout rollout"
        saving={false}
        copy={changeRequestsCopy("en")}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Approve" }))

    expect(onConfirm).toHaveBeenCalledWith("")
    expect(screen.getByText("(optional)")).toBeInTheDocument()
    expect(screen.getByText("Raise checkout rollout")).toHaveClass(
      "font-semibold",
      "text-foreground"
    )
  })

  it("requires and trims a decline comment", () => {
    const onConfirm = vi.fn()
    render(
      <ChangeRequestDecisionDialog
        action="decline"
        requestTitle="Raise checkout rollout"
        saving={false}
        copy={changeRequestsCopy("en")}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    const decline = screen.getByRole("button", { name: "Decline" })
    expect(decline).toBeDisabled()
    expect(
      screen.getByText("A comment is required when declining.")
    ).toBeInTheDocument()
    expect(screen.getByText("Raise checkout rollout")).toHaveClass(
      "font-semibold",
      "text-foreground"
    )

    fireEvent.change(screen.getByRole("textbox", { name: /Comment/ }), {
      target: { value: "  Needs a rollback plan.  " },
    })
    fireEvent.click(decline)

    expect(onConfirm).toHaveBeenCalledWith("Needs a rollback plan.")
  })
})
