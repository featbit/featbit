import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { FeatureFlag } from "../../flags-types"
import { InsightsTab } from "./insights-tab"

vi.mock("./insights-api", () => ({
  fetchFeatureFlagInsights: vi.fn().mockResolvedValue([]),
  fetchEvaluatedEndUsers: vi
    .fn()
    .mockResolvedValue({ totalCount: 0, items: [] }),
}))

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout redesign",
  key: "checkout-redesign",
  tags: [],
  isEnabled: true,
  createdAt: "2026-07-27T08:00:00.000Z",
  updatedAt: "2026-07-27T08:00:00.000Z",
  variationType: "boolean",
  variations: [],
}

function renderInsights(value: FeatureFlag) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <InsightsTab
          envId="env-1"
          flag={value}
          settingsPath="/en/feature-flags/checkout-redesign/settings"
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("InsightsTab", () => {
  it("explains that collection is disabled and links to settings", () => {
    renderInsights({ ...flag, insightsEnabled: false })

    expect(
      screen.getByText("Insight collection is disabled for this flag")
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute(
      "href",
      "/en/feature-flags/checkout-redesign/settings"
    )
  })

  it("shows no notice when insights are enabled or the field is missing", () => {
    const { unmount } = renderInsights({ ...flag, insightsEnabled: true })
    expect(
      screen.queryByText("Insight collection is disabled for this flag")
    ).not.toBeInTheDocument()
    unmount()

    renderInsights(flag)
    expect(
      screen.queryByText("Insight collection is disabled for this flag")
    ).not.toBeInTheDocument()
  })
})
