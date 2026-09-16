import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import { fetchFeatureFlag } from "@/features/flags/flags-api"
import type { ProjectEnv } from "@/features/layout/layout-types"
import type { MetricMonitorBinding } from "../release-health-api"
import { MetricLinkedFlags } from "./metric-linked-flags"

vi.mock("@/features/flags/flags-api", () => ({ fetchFeatureFlag: vi.fn() }))
const readBindings = vi.fn<() => Promise<MetricMonitorBinding[]>>()
const context: ProjectEnv = {
  projectId: "project-1",
  projectName: "Commerce",
  projectKey: "commerce",
  envId: "env-prod",
  envName: "Prod",
  envKey: "prod",
}
const binding: MetricMonitorBinding = {
  id: "binding-1",
  metricId: "metric-1",
  metricVersionId: "version-1",
  metricVersion: 1,
  flagId: "flag-1",
  flagKey: "checkout_v2",
  monitorName: "A monitor name",
  status: "enabled",
  use: "Guard",
  window: "5m",
  rule: "> 2%",
  latestCheck: "Healthy",
  createdAt: "2026-09-15T02:30:00Z",
}

function Content() {
  const bindings = useQuery({
    queryKey: ["bindings"],
    queryFn: readBindings,
    retry: false,
  })
  return <MetricLinkedFlags context={context} bindings={bindings} />
}

function show() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/en/metric"]}>
        <Routes>
          <Route path="/:lang/metric" element={<Content />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("Metric linked feature flags", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("en")
    readBindings.mockResolvedValue([binding])
    vi.mocked(fetchFeatureFlag).mockResolvedValue({
      id: "flag-1",
      key: "checkout_v2",
      name: "Checkout v2",
      isEnabled: false,
      variationType: "boolean",
      tags: [],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-09-16T00:00:00Z",
    })
  })

  it("groups bindings by flag and uses the real environment flag state and binding time", async () => {
    readBindings.mockResolvedValue([
      {
        ...binding,
        id: "newer",
        metricVersion: 2,
        createdAt: "2026-09-16T02:30:00Z",
      },
      { ...binding, status: "paused" },
    ])
    show()
    await waitFor(() => expect(screen.getByText("Checkout v2")).toBeVisible())
    const table = screen.getByRole("table")
    expect(within(table).getAllByRole("row")).toHaveLength(2)
    expect(within(table).getByText("Disabled")).toBeVisible()
    expect(
      within(table).getByText(
        new Date(binding.createdAt!).toLocaleString("en-US")
      )
    ).toBeVisible()
    expect(fetchFeatureFlag).toHaveBeenCalledTimes(1)
    expect(fetchFeatureFlag).toHaveBeenCalledWith("env-prod", "checkout_v2")
    expect(
      within(table).getByRole("link", { name: "Feature flag" })
    ).toHaveAttribute("href", "/en/feature-flags/checkout_v2/targeting")
    expect(
      within(table).getByRole("link", { name: "Monitoring" })
    ).toHaveAttribute(
      "href",
      "/en/feature-flags/checkout_v2/release-health#metric-bindings"
    )
    for (const label of [
      "Status",
      "Use",
      "Window",
      "Rule",
      "Latest rule check",
    ]) {
      expect(
        within(table).queryByRole("columnheader", { name: label })
      ).not.toBeInTheDocument()
    }
    expect(screen.queryByText(binding.monitorName)).not.toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
  })

  it("keeps an unknown binding time instead of substituting the flag creation time", async () => {
    readBindings.mockResolvedValue([{ ...binding, createdAt: undefined }])
    show()
    await waitFor(() => expect(screen.getByText("Checkout v2")).toBeVisible())
    expect(screen.getByText("Unknown")).toBeVisible()
    expect(
      screen.queryByText(
        new Date("2026-01-01T00:00:00Z").toLocaleString("en-US")
      )
    ).not.toBeInTheDocument()
  })

  it("shows a retryable load error without claiming that no flags are linked", async () => {
    readBindings.mockRejectedValueOnce(new Error("Unavailable"))
    show()
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Linked feature flags could not be loaded."
    )
    expect(
      screen.queryByText("No linked feature flags to display in Prod.")
    ).not.toBeInTheDocument()
    readBindings.mockResolvedValue([])
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(
      await screen.findByText("No linked feature flags to display in Prod.")
    ).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
