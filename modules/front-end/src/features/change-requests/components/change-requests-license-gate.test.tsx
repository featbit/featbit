import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import "@/lib/i18n/i18n"
import { ChangeRequestsLicenseGate } from "./change-requests-license-gate"

describe("ChangeRequestsLicenseGate", () => {
  it("links the single recovery action to license management", () => {
    render(
      <MemoryRouter>
        <ChangeRequestsLicenseGate manageLicenseHref="/en/workspace/license" />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("heading", {
        name: "Your license doesn't include Change Requests",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Manage license" })
    ).toHaveAttribute("href", "/en/workspace/license")
    expect(
      screen.queryByRole("link", { name: "Learn about Change Requests" })
    ).not.toBeInTheDocument()
  })
})
