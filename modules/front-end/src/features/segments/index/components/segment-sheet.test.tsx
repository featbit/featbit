import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { ScopeResource } from "../../segments-types"
import { SegmentSheet } from "./segment-sheet"

const currentScope: ScopeResource = {
  id: "env-1",
  name: "Production",
  pathName: "Acme / Web / Production",
  rn: "organization/acme:project/web:env/production",
  type: "env",
}

function renderSheet() {
  return render(
    <MemoryRouter>
      <SegmentSheet
        open
        currentScope={currentScope}
        resources={[currentScope]}
        resourcesLoading={false}
        resourcesError={false}
        shareableGranted={false}
        manageLicenseHref="/en/workspace/license"
        saving={false}
        onOpenChange={vi.fn()}
        onRetryResources={vi.fn()}
        onValidateKey={vi.fn().mockResolvedValue(false)}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    </MemoryRouter>
  )
}

describe("SegmentSheet", () => {
  it("replaces the unavailable Shareable form with a recoverable license gate", () => {
    renderSheet()

    fireEvent.click(screen.getByRole("radio", { name: /Shareable/ }))

    expect(
      screen.getByRole("heading", {
        name: "Your license doesn't include Shareable Segments",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Manage license" })
    ).toHaveAttribute("href", "/en/workspace/license")
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Create segment" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible()

    fireEvent.click(screen.getByRole("radio", { name: "This environment" }))

    expect(screen.getByLabelText("Name")).toBeVisible()
    expect(screen.getByRole("button", { name: "Create segment" })).toBeVisible()
  })
})
