import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { PolicyStatement } from "../permission-model"
import { PermissionsEditor } from "./permissions-editor"

const mocks = vi.hoisted(() => ({
  fetchPolicyResources: vi.fn(),
}))

vi.mock("../policy-details-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../policy-details-api")>()),
  fetchPolicyResources: mocks.fetchPolicyResources,
}))

function renderEditor(statements: PolicyStatement[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PermissionsEditor
          policy={{
            id: "policy-1",
            key: "environment-access",
            name: "Environment access",
            type: "CustomerManaged",
            statements,
          }}
          loading={false}
          lang="en"
          onPolicyChange={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function envStatement(resources: string[]): PolicyStatement {
  return {
    id: "statement-1",
    resourceType: "env",
    effect: "allow",
    actions: ["CanAccessEnv"],
    resources,
  }
}

describe("PermissionsEditor resource summaries", () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.fetchPolicyResources.mockReset()
  })

  it("uses resource names in the summary and complete-list tooltip", async () => {
    const resources = [
      "project/shop:env/prod",
      "project/shop:env/stage",
      "project/shop:env/dev",
      "project/shop:env/retired",
    ]
    mocks.fetchPolicyResources.mockResolvedValue([
      { id: "1", name: "Production", rn: resources[0], type: "env" },
      { id: "2", name: "Staging", rn: resources[1], type: "env" },
      { id: "3", name: "Development", rn: resources[2], type: "env" },
    ])

    renderEditor([envStatement(resources)])

    expect(
      await screen.findByText("Production, Staging & Development")
    ).toBeVisible()
    expect(mocks.fetchPolicyResources).toHaveBeenCalledWith("", "env")

    fireEvent.mouseEnter(screen.getByLabelText("1 more resources"))
    expect(await screen.findByText("retired")).toBeVisible()
  })

  it("keeps the RN-derived key when the resource lookup fails", async () => {
    mocks.fetchPolicyResources.mockRejectedValue(new Error("Unavailable"))

    renderEditor([envStatement(["project/shop:env/prod"])])

    await waitFor(() =>
      expect(mocks.fetchPolicyResources).toHaveBeenCalledWith("", "env")
    )
    expect(screen.getByText("prod")).toBeVisible()
  })

  it("does not load a resource catalog for an all-resources scope", () => {
    renderEditor([envStatement(["project/*:env/*"])])

    expect(screen.getByText("All Environment resources")).toBeVisible()
    expect(mocks.fetchPolicyResources).not.toHaveBeenCalled()
  })

  it("marks the page draft as unsaved after applying an RN edit", async () => {
    mocks.fetchPolicyResources.mockResolvedValue([])
    renderEditor([envStatement(["project/shop:env/prod"])])

    const saveChanges = screen.getByRole("button", { name: "Save changes" })
    expect(saveChanges).toBeDisabled()
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Toggle permission 1" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Edit resource name for prod" })
    )

    const environment = screen.getByLabelText("Environment")
    await waitFor(() => expect(environment).toHaveValue("prod"))
    fireEvent.change(environment, { target: { value: "staging" } })

    const apply = screen.getByRole("button", { name: "Apply" })
    await waitFor(() => expect(apply).toBeEnabled())
    fireEvent.click(apply)

    expect(await screen.findByText("Unsaved changes")).toBeVisible()
    expect(saveChanges).toBeEnabled()
  })

  it("explains that the paid feature applies to specific actions", () => {
    renderEditor([
      {
        id: "statement-1",
        resourceType: "flag",
        effect: "allow",
        actions: ["*"],
        resources: ["project/*:env/*:flag/*"],
      },
    ])

    expect(
      screen.getByText("Fine-grained access control permissions")
    ).toBeVisible()
    expect(
      screen.getByText(
        "Choosing specific actions for feature flags and segments requires the paid Fine-grained access control add-on. Contact the FeatBit team to add it to your license."
      )
    ).toBeVisible()
  })
})
