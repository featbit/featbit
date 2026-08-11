import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { ChangeRequestPreview } from "../change-requests-types"
import { ChangeRequestPreviewAlert } from "./change-request-preview-alert"

const preview = {
  id: "request-1",
  reason: "Increase checkout exposure after QA.",
  status: "Approved",
  flag: {},
} as ChangeRequestPreview

describe("ChangeRequestPreviewAlert", () => {
  it("labels the projected configuration as unapplied and exits preview", () => {
    const onExit = vi.fn()
    render(
      <ChangeRequestPreviewAlert
        preview={preview}
        failed={false}
        onRetry={vi.fn()}
        onExit={onExit}
      />
    )

    expect(screen.getByText("Previewing change request")).toBeVisible()
    expect(screen.getByText("Approved")).toBeVisible()
    expect(
      screen.getByText(
        "This is how Targeting will look after this change request is applied. The current configuration has not changed."
      )
    ).toBeVisible()
    expect(screen.getByText(preview.reason)).toBeVisible()

    fireEvent.click(
      screen.getByRole("button", { name: "View current targeting" })
    )
    expect(onExit).toHaveBeenCalledOnce()
  })

  it("keeps current targeting untouched when the preview cannot load", () => {
    const onRetry = vi.fn()
    render(
      <ChangeRequestPreviewAlert failed onRetry={onRetry} onExit={vi.fn()} />
    )

    expect(
      screen.getByText("Change request preview could not be loaded.")
    ).toBeVisible()
    expect(
      screen.getByText("The current Targeting configuration has not changed.")
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("labels an applied request as the current read-only configuration", () => {
    render(
      <ChangeRequestPreviewAlert
        preview={{ ...preview, status: "Applied" }}
        failed={false}
        onRetry={vi.fn()}
        onExit={vi.fn()}
      />
    )

    expect(screen.getByText("Change request applied")).toBeVisible()
    expect(
      screen.getByText(
        "This change request has been applied. You are viewing the current Targeting configuration in read-only mode."
      )
    ).toBeVisible()
  })
})
