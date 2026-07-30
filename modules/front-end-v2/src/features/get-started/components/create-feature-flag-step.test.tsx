import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CreateFeatureFlagStep } from "./create-feature-flag-step"

window.HTMLElement.prototype.scrollIntoView = vi.fn()

const mocks = vi.hoisted(() => ({
  createFeatureFlag: vi.fn(),
  fetchFeatureFlags: vi.fn(),
  fetchFlagPolicies: vi.fn(),
  isFeatureFlagKeyUsed: vi.fn(),
}))

vi.mock("@/features/flags/flags-api", () => ({
  createFeatureFlag: mocks.createFeatureFlag,
  fetchFeatureFlags: mocks.fetchFeatureFlags,
  fetchFlagPolicies: mocks.fetchFlagPolicies,
  isFeatureFlagKeyUsed: mocks.isFeatureFlagKeyUsed,
}))

vi.mock("@/features/layout/layout-context", () => ({
  getCurrentProjectEnv: () => ({
    projectId: "project-1",
    projectName: "Platform",
    projectKey: "platform",
    envId: "env-1",
    envName: "Production",
    envKey: "production",
  }),
  getCurrentWorkspace: () => ({ id: "workspace-1" }),
}))

function renderStep(onComplete = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreateFeatureFlagStep value={null} onComplete={onComplete} />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return onComplete
}

describe("CreateFeatureFlagStep", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchFlagPolicies.mockResolvedValue([
      { type: "Owner", statements: [] },
    ])
    mocks.isFeatureFlagKeyUsed.mockResolvedValue(false)
    mocks.createFeatureFlag.mockResolvedValue({ key: "checkout-redesign" })
  })

  it("reuses an existing flag without changing it", async () => {
    mocks.fetchFeatureFlags.mockResolvedValue({
      totalCount: 1,
      items: [
        {
          id: "flag-1",
          name: "Checkout redesign",
          key: "checkout-redesign",
          description: "Controls checkout",
          tags: [],
          variationType: "boolean",
          isEnabled: false,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    })
    const onComplete = renderStep()

    fireEvent.click(
      await screen.findByRole("combobox", {
        name: /select or create a feature flag/i,
      })
    )
    fireEvent.click(
      await screen.findByRole("option", { name: /checkout redesign/i })
    )
    fireEvent.click(screen.getByRole("button", { name: "Continue with flag" }))

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ key: "checkout-redesign" })
    )
    expect(mocks.createFeatureFlag).not.toHaveBeenCalled()
  })

  it("creates a disabled Boolean flag and continues", async () => {
    mocks.fetchFeatureFlags.mockResolvedValue({ totalCount: 0, items: [] })
    const onComplete = renderStep()

    const name = await screen.findByLabelText("Name")
    fireEvent.change(name, { target: { value: "Checkout redesign" } })
    expect(screen.getByLabelText("Key")).toHaveValue("checkout-redesign")

    const createButton = screen.getByRole("button", {
      name: "Create & continue",
    })
    await waitFor(() => expect(createButton).toBeEnabled(), { timeout: 2000 })
    fireEvent.click(createButton)

    await waitFor(() => expect(mocks.createFeatureFlag).toHaveBeenCalled())
    expect(mocks.createFeatureFlag).toHaveBeenCalledWith(
      "env-1",
      expect.objectContaining({
        name: "Checkout redesign",
        key: "checkout-redesign",
        variationType: "boolean",
        isEnabled: false,
      })
    )
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ key: "checkout-redesign" })
      )
    )
  })
})
