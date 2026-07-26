import { render, screen } from "@testing-library/react"
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
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled()
  })
})
