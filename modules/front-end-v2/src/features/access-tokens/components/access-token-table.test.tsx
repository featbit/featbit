import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import "../access-tokens-i18n"
import { AccessTokenTable } from "./access-token-table"

describe("AccessTokenTable", () => {
  it("shows the creator name and email and links the name to team details", () => {
    render(
      <MemoryRouter initialEntries={["/en/integrations/access-tokens"]}>
        <AccessTokenTable
          data={[
            {
              id: "token-1",
              name: "Deployment automation",
              type: "Service",
              creator: {
                id: "member-1",
                name: "Ada Lovelace",
                email: "ada@example.com",
              },
            },
          ]}
          lang="en"
          loading={false}
          emptyMessage="No access tokens"
          isManageable={() => false}
          mutatingId={null}
          onEdit={vi.fn()}
          onView={vi.fn()}
          onActivate={vi.fn()}
          onDeactivate={vi.fn()}
          onRemove={vi.fn()}
        />
      </MemoryRouter>
    )

    const creatorName = screen.getByRole("link", { name: "Ada Lovelace" })
    const creatorEmail = screen.getByText("ada@example.com")

    expect(creatorEmail).toBeVisible()
    expect(creatorEmail).not.toHaveAttribute("title")
    expect(creatorName).toHaveAttribute(
      "href",
      "/en/iam/team/member-1/permissions"
    )
    expect(creatorName).not.toHaveAttribute("title")
  })
})
