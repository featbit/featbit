import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import "@/lib/i18n/i18n"
import { i18n } from "@/lib/i18n/i18n"
import type { FeatureFlag } from "@/features/flags/flags-types"
import { SourceConnectionsPage } from "./connections/source-connections-page"
import { FlagReleaseHealthTab } from "./flag/flag-release-health-tab"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { releaseHealthApi } from "./release-health-api"
import { ReleaseMetricDetailsPage } from "./metrics/release-metric-details-page"
import { ReleaseMetricSourceBindingPage } from "./metrics/release-metric-source-binding-page"
import { ReleaseHealthOverviewPage } from "./overview/release-health-overview-page"
import { HealthSessionDetailsPage } from "./sessions/health-session-details-page"

vi.mock("./release-health-api", async (original) => ({
  ...(await original<typeof import("./release-health-api")>()),
  releaseHealthApi: {
    metrics: vi.fn(),
    trend: vi.fn(),
    binding: vi.fn(),
    connections: vi.fn(),
  },
}))
vi.mock("@/features/layout/layout-context", async (original) => ({
  ...(await original<typeof import("@/features/layout/layout-context")>()),
  fetchProjects: vi.fn(async () => [
    {
      id: "project-commerce",
      name: "Commerce",
      key: "commerce",
      environments: [
        { id: "env-production", key: "production", name: "Production" },
        { id: "env-staging", key: "staging", name: "Staging" },
      ],
    },
  ]),
}))
const contract = {
  schemaVersion: 1 as const,
  resultKind: "numeric_time_series" as const,
  cardinality: "single" as const,
  measurementKind: "ratio" as const,
  unit: { kind: "percent" as const, scale: "zero_to_one_hundred" as const },
  constraints: { allowNaN: false as const, allowInfinity: false as const },
}
function renderLive(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(
    ["current-user-policies", ""],
    [
      {
        type: "custom",
        statements: [
          {
            resourceType: "*",
            effect: "allow",
            actions: ["*"],
            resources: ["*"],
          },
        ],
      },
    ]
  )
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}
const flag: FeatureFlag = {
  id: "flag-1",
  name: "Search ranking v3",
  key: "search-ranking-v3",
  tags: ["production"],
  isEnabled: true,
  createdAt: "2026-08-01T10:00:00Z",
  updatedAt: "2026-08-28T10:12:00Z",
  variationType: "boolean",
  revision: "rev_search_031",
}

describe("Release Health design pages", () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(
      "auth",
      JSON.stringify({ id: "user-1", name: "Designer" })
    )
    localStorage.setItem(
      "current-project_user-1",
      JSON.stringify({
        projectId: "project-commerce",
        projectName: "Commerce",
        projectKey: "commerce",
        envId: "env-production",
        envName: "Production",
        envKey: "production",
      })
    )
    vi.mocked(releaseHealthApi.metrics).mockResolvedValue([
      {
        id: "metric-error",
        projectId: "project-commerce",
        metricVersionId: "v1",
        version: 1,
        key: "checkout_error_rate",
        name: "Checkout error rate",
        resultSemantics: "Error rate across all requests.",
        resultContract: contract,
      },
      {
        id: "metric-latency",
        projectId: "project-commerce",
        metricVersionId: "v2",
        version: 1,
        key: "api_p95_latency",
        name: "API P95 latency",
        resultSemantics: "95th percentile response latency.",
        resultContract: contract,
      },
    ])
    vi.mocked(releaseHealthApi.trend).mockImplementation(async (scope) => ({
      status: scope.envId === "env-staging" ? "not_connected" : "no_data",
      queriedAt: "2026-09-03T00:00:00Z",
      resultContract: contract,
      points: [],
      freshnessSeconds: null,
    }))
    vi.mocked(releaseHealthApi.binding).mockResolvedValue(null)
    vi.mocked(releaseHealthApi.connections).mockResolvedValue([])
    await i18n.changeLanguage("en")
  })

  it("explains project metric scope and environment evidence on overview", () => {
    render(
      <MemoryRouter initialEntries={["/en/release-health"]}>
        <ReleaseHealthOverviewPage />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("heading", { name: "Release Health" })
    ).toBeVisible()
    expect(
      screen.getByText(
        "Metric definitions belong to Commerce. Readings, monitors, and sessions below belong to Production."
      )
    ).toBeVisible()
    expect(screen.getByText("Environment metric streams")).toBeVisible()
  })

  it("keeps a shared metric free of a standalone health verdict", async () => {
    renderLive(
      <MemoryRouter
        initialEntries={["/en/release-health/metrics/api_p95_latency"]}
      >
        <Routes>
          <Route
            path="/:lang/release-health/metrics/:metricKey"
            element={<ReleaseMetricDetailsPage />}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(
      await screen.findByRole("heading", { name: "API P95 latency" })
    ).toBeVisible()
    expect(
      screen.getByText(
        /This page shows value, trend, freshness, and Data status/
      )
    ).toBeVisible()
    expect(screen.getByText("Environment trend")).toBeVisible()
    expect(screen.getByText("Environment streams")).toBeVisible()
    expect(await screen.findByText("Not connected")).toBeVisible()
    expect(screen.getAllByText("No data")[0]).toBeVisible()
    expect(screen.getByText("Monitor bindings")).toBeVisible()
  })

  it("manages reusable source connections inside the selected environment", () => {
    render(
      <MemoryRouter initialEntries={["/en/release-health/connections"]}>
        <SourceConnectionsPage />
      </MemoryRouter>
    )

    expect(screen.getByRole("tab", { name: "Connections" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(
      screen.getByText(
        "Connections are managed inside Commerce and isolated to Production. A connection can be reused by multiple metric bindings in this environment only."
      )
    ).toBeVisible()
    expect(screen.getByText("Environment connections")).toBeVisible()
    expect(screen.getAllByText("Prometheus-compatible")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Add connection" })).toBeVisible()
  })

  it("requires a bearer token before testing a new authenticated connection", () => {
    render(
      <MemoryRouter initialEntries={["/en/release-health/connections"]}>
        <SourceConnectionsPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: "Add connection" }))
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Preview metrics" },
    })
    fireEvent.change(screen.getByLabelText("Endpoint"), {
      target: { value: "https://prometheus.preview.local" },
    })

    expect(
      screen.getByRole("button", { name: "Test connection" })
    ).toBeDisabled()

    expect(
      screen.getByText(
        "Paste the token only. FeatBit adds the Authorization: Bearer prefix."
      )
    ).toBeVisible()

    fireEvent.change(screen.getByLabelText("Token"), {
      target: { value: "preview-token" },
    })

    expect(
      screen.getByRole("button", { name: "Test connection" })
    ).toBeEnabled()
  })

  it("switches between the Basic and no-authentication field sets", () => {
    render(
      <MemoryRouter initialEntries={["/en/release-health/connections"]}>
        <SourceConnectionsPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: "Add connection" }))
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Internal Prometheus" },
    })
    fireEvent.change(screen.getByLabelText("Endpoint"), {
      target: { value: "https://prometheus.internal.example.com" },
    })

    fireEvent.click(screen.getByLabelText("Authentication"))
    const basicOption = screen.getByRole("option", {
      name: "Basic authentication",
    })
    fireEvent.pointerDown(basicOption, { pointerType: "mouse", button: 0 })
    fireEvent.click(basicOption, { detail: 1 })

    expect(screen.getByLabelText("Username")).toBeVisible()
    expect(screen.getByLabelText("Password")).toBeVisible()
    expect(screen.queryByLabelText("Token")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "metrics-reader" },
    })
    expect(
      screen.getByRole("button", { name: "Test connection" })
    ).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "write-only-password" },
    })
    expect(
      screen.getByRole("button", { name: "Test connection" })
    ).toBeEnabled()

    fireEvent.click(screen.getByLabelText("Authentication"))
    const noAuthenticationOption = screen.getByRole("option", {
      name: "No authentication",
    })
    fireEvent.pointerDown(noAuthenticationOption, {
      pointerType: "mouse",
      button: 0,
    })
    fireEvent.click(noAuthenticationOption, { detail: 1 })

    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Token")).not.toBeInTheDocument()
    expect(screen.getByText("No credential will be stored")).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Test connection" })
    ).toBeEnabled()
  })

  it("shows configured state without revealing a stored credential", () => {
    render(
      <MemoryRouter initialEntries={["/en/release-health/connections"]}>
        <SourceConnectionsPage />
      </MemoryRouter>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Edit Production metrics" })
    )

    expect(screen.getByText("Stored credential")).toBeVisible()
    expect(screen.getByText("Configured")).toBeVisible()
    expect(screen.getByLabelText("Token")).toHaveValue("")
    expect(screen.getByLabelText("Token")).toHaveAttribute(
      "placeholder",
      "Enter a new token to replace the configured token"
    )
  })

  it("previews provider-specific configuration for planned adapters", () => {
    render(
      <MemoryRouter initialEntries={["/en/release-health/connections"]}>
        <SourceConnectionsPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: "Add connection" }))

    const datadog = screen.getByRole("button", { name: /Datadog/ })
    fireEvent.click(datadog)
    expect(datadog).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByLabelText("Datadog site")).toBeVisible()
    expect(screen.getByLabelText("API key")).toBeVisible()
    expect(screen.getByLabelText("Application key")).toBeVisible()
    expect(screen.getByText("Datadog is coming soon")).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Test connection" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Save connection" })
    ).toBeDisabled()

    const newRelic = screen.getByRole("button", { name: /New Relic/ })
    fireEvent.click(newRelic)
    expect(screen.getByLabelText("Region")).toBeVisible()
    expect(screen.getByLabelText("Account ID")).toBeVisible()
    expect(screen.getByLabelText("User API key")).toBeVisible()

    const azureDataExplorer = screen.getByRole("button", {
      name: /Azure Data Explorer/,
    })
    fireEvent.click(azureDataExplorer)
    expect(screen.getByLabelText("Cluster URI")).toBeVisible()
    expect(screen.getByLabelText("Database")).toBeVisible()
    expect(screen.getByLabelText("Tenant ID")).toBeVisible()
    expect(screen.getByLabelText("Client ID")).toBeVisible()
    expect(screen.getByLabelText("Client secret")).toBeVisible()
  })

  it("configures an environment source through the four-step PromQL flow", async () => {
    renderLive(
      <MemoryRouter
        initialEntries={[
          "/en/release-health/metrics/checkout_error_rate/source-bindings/production",
        ]}
      >
        <Routes>
          <Route
            path="/:lang/release-health/metrics/:metricKey/source-bindings/:environmentKey"
            element={<ReleaseMetricSourceBindingPage />}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(
      await screen.findByRole("heading", { name: "Manage source binding" })
    ).toBeVisible()
    expect(await screen.findByText("1. Provider and connection")).toBeVisible()
    expect(screen.getByText("2. Query and schedule")).toBeVisible()
    expect(screen.getByText("3. Validate and preview")).toBeVisible()
    expect(screen.getByText("4. Review and save")).toBeVisible()
    expect(screen.getByLabelText("PromQL")).toBeVisible()
    expect(screen.getByText(/query_range · range/)).toBeVisible()
    expect(screen.queryByLabelText("Feature flag")).not.toBeInTheDocument()
    expect(screen.queryByText("Observation scope")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Detected context capabilities")
    ).not.toBeInTheDocument()
  })

  it("does not attach preview monitor rules to persisted metric keys", async () => {
    renderLive(
      <MemoryRouter
        initialEntries={["/en/release-health/metrics/checkout_error_rate"]}
      >
        <Routes>
          <Route
            path="/:lang/release-health/metrics/:metricKey"
            element={<ReleaseMetricDetailsPage />}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(
      await screen.findByRole("heading", { name: "Checkout error rate" })
    ).toBeVisible()
    expect(screen.queryByText("> 2% for 5 min")).toBeNull()
    expect(
      screen.getAllByText(
        "Monitor and Session references are not connected to the API yet."
      ).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText("> 800 ms for 10 min")).not.toBeInTheDocument()
  })

  it("uses non-causal language on session evidence", () => {
    render(
      <MemoryRouter
        initialEntries={["/en/release-health/sessions/session-checkout-042"]}
      >
        <Routes>
          <Route
            path="/:lang/release-health/sessions/:sessionId"
            element={<HealthSessionDetailsPage />}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(
      screen.getByRole("heading", { name: "Observation session HS-042" })
    ).toBeVisible()
    expect(
      screen.getByText(
        /does not claim that this feature flag caused the anomaly/
      )
    ).toBeVisible()
    expect(screen.getByText("Pinned configuration snapshot")).toBeVisible()
  })

  it("shows monitor, quick observation, and change-bound entry points on a flag", () => {
    render(
      <MemoryRouter
        initialEntries={["/en/feature-flags/search-ranking-v3/release-health"]}
      >
        <FlagReleaseHealthTab envId="env-production" flag={flag} lang="en" />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("button", { name: "Monitor this change" })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Quick observation" })
    ).toBeVisible()
    expect(screen.getByText("Monitor metric bindings")).toBeVisible()
    expect(screen.getByText(/They are not causal attribution/)).toBeVisible()
    expect(screen.getByText("Design preview")).toBeVisible()
    expect(screen.getAllByText("Search ranking v3").length).toBeGreaterThan(0)
    expect(screen.getAllByText("search-ranking-v3").length).toBeGreaterThan(0)
    expect(screen.queryByText("Checkout redesign")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Checkout safety monitor")
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Open evidence/ })
    ).toHaveAttribute(
      "href",
      "/en/release-health/sessions?flagKey=search-ranking-v3&previewSession=session-checkout-042"
    )
    screen
      .getAllByRole("link", { name: "HS-042" })
      .forEach((link) =>
        expect(link).toHaveAttribute(
          "href",
          "/en/release-health/sessions?flagKey=search-ranking-v3&previewSession=session-checkout-042"
        )
      )
    expect(
      screen.getAllByText("Search ranking v3: Rollout changed from 10% to 25%")
        .length
    ).toBeGreaterThan(0)
  })
})
