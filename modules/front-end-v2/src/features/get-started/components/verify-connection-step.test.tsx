import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { VerifyConnectionStep } from "./verify-connection-step"

const mocks = vi.hoisted(() => ({
  fetchFeatureFlagInsights: vi.fn(),
}))

vi.mock("@/features/flags/details/insights/insights-api", () => ({
  fetchFeatureFlagInsights: mocks.fetchFeatureFlagInsights,
}))

describe("VerifyConnectionStep", () => {
  it("finishes when an evaluation count is detected", async () => {
    mocks.fetchFeatureFlagInsights.mockResolvedValue([
      { time: "now", variations: [{ variation: "true", count: 1 }] },
    ])
    const onExit = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <VerifyConnectionStep
          envId="env-1"
          flag={{
            name: "Checkout redesign",
            key: "checkout-redesign",
            variationType: "boolean",
            isEnabled: false,
          }}
          sdkId="node"
          onBack={vi.fn()}
          onExit={onExit}
        />
      </QueryClientProvider>
    )

    expect(await screen.findByText("Connection verified")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "View feature flags" }))
    expect(onExit).toHaveBeenCalledOnce()
  })
})
