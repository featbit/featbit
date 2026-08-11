import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { MemberPermission } from "../permissions-api"
import { PermissionsTab } from "./permissions-tab"

const permission: MemberPermission = {
  statementId: "statement-1",
  resourceType: "env",
  effect: "allow",
  actions: ["CanAccessEnv", "UpdateEnvSettings"],
  resources: ["project/example-project:env/prod"],
  policyId: "policy-1",
  policyName: "Environment administrators",
  policyType: "custom",
  sources: [
    {
      assignmentType: "group",
      groupId: "group-1",
      groupName: "Platform team",
    },
  ],
}

function renderPermissions(items = [permission]) {
  return render(
    <MemoryRouter>
      <PermissionsTab
        memberId="member-1"
        lang="en"
        items={items}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />
    </MemoryRouter>
  )
}

describe("PermissionsTab", () => {
  it("expands a permission into a complete read-only statement", () => {
    renderPermissions()

    const toggle = screen.getByRole("button", {
      name: "Expand permission from Environment administrators",
    })
    const policyLink = screen.getByRole("link", {
      name: "Environment administrators",
    })

    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(policyLink).toHaveClass(
      "line-clamp-2",
      "font-semibold",
      "text-foreground",
      "hover:underline",
      "focus-visible:ring-2"
    )
    expect(screen.queryByText("CanAccessEnv")).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Resources")).toBeInTheDocument()
    expect(screen.getByText("Environment", { exact: true })).toBeVisible()
    expect(screen.queryByText("Resource type")).not.toBeInTheDocument()
    expect(screen.getByText("project/example-project:env/prod")).toBeVisible()
    expect(screen.getByText("CanAccessEnv")).toBeVisible()
    expect(screen.getByText("UpdateEnvSettings")).toBeVisible()
    expect(screen.queryByText(permission.statementId)).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("CanAccessEnv")).not.toBeInTheDocument()
  })

  it("keeps only one permission expanded", () => {
    renderPermissions([
      permission,
      {
        ...permission,
        statementId: "statement-2",
        policyId: "policy-2",
        policyName: "Project viewers",
        resourceType: "project",
        resources: ["project/example-project"],
        actions: ["CanAccessProject"],
      },
    ])

    const first = screen.getByRole("button", {
      name: "Expand permission from Environment administrators",
    })
    const second = screen.getByRole("button", {
      name: "Expand permission from Project viewers",
    })

    fireEvent.click(first)
    expect(first).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(second)
    expect(first).toHaveAttribute("aria-expanded", "false")
    expect(second).toHaveAttribute("aria-expanded", "true")
    expect(screen.queryByText("CanAccessEnv")).not.toBeInTheDocument()
    expect(screen.getByText("CanAccessProject")).toBeVisible()
  })

  it("enables the full-list tooltip when an uncounted summary is truncated", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100)

    renderPermissions()

    const resourceSummary = screen.getByText("prod")
    await waitFor(() =>
      expect(resourceSummary).toHaveAttribute("tabindex", "0")
    )

    fireEvent.focus(resourceSummary)
    expect(
      await screen.findByText("project/example-project:env/prod")
    ).toBeVisible()

    vi.restoreAllMocks()
  })
})
