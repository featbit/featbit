import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FlagJsonEditorDialog } from "./flag-json-editor-dialog"

describe("FlagJsonEditorDialog", () => {
  it("shows a syntax error and prevents applying invalid JSON", () => {
    render(
      <FlagJsonEditorDialog
        open
        lang="en"
        variationName="Broken JSON"
        value="{invalid"
        onOpenChange={vi.fn()}
        onApply={vi.fn()}
      />
    )

    expect(screen.getByTestId("flag-json-code-editor")).toContainElement(
      document.querySelector(".cm-editor")
    )
    expect(screen.getByText(/JSON syntax error:/)).toBeVisible()
    expect(screen.getByRole("button", { name: "Format" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled()
  })

  it("accepts JSON arrays", () => {
    render(
      <FlagJsonEditorDialog
        open
        lang="en"
        variationName="Array JSON"
        value="[]"
        onOpenChange={vi.fn()}
        onApply={vi.fn()}
      />
    )

    expect(screen.getByText("Valid JSON object or array")).toBeVisible()
    expect(screen.getByRole("button", { name: "Format" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled()
  })

  it("formats valid JSON on open and applies compact JSON", () => {
    const onApply = vi.fn()
    render(
      <FlagJsonEditorDialog
        open
        lang="en"
        variationName="Configuration"
        value='{"enabled":true,"limits":[1,2]}'
        onOpenChange={vi.fn()}
        onApply={onApply}
      />
    )

    expect(
      screen
        .getByTestId("flag-json-code-editor")
        .querySelectorAll(".cm-line")
    ).toHaveLength(7)

    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenCalledWith(
      '{"enabled":true,"limits":[1,2]}'
    )
  })

  it("preserves whitespace inside JSON string values when applying", () => {
    const onApply = vi.fn()
    render(
      <FlagJsonEditorDialog
        open
        lang="en"
        variationName="Message"
        value='{"message":"hello world there"}'
        onOpenChange={vi.fn()}
        onApply={onApply}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onApply).toHaveBeenCalledWith(
      '{"message":"hello world there"}'
    )
  })
})
import "@/lib/i18n/i18n"
