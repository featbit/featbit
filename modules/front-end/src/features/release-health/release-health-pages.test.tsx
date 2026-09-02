import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import "@/lib/i18n/i18n"
import { i18n } from "@/lib/i18n/i18n"
import type { FeatureFlag } from "@/features/flags/flags-types"
import { SourceConnectionsPage } from "./connections/source-connections-page"
import { FlagReleaseHealthTab } from "./flag/flag-release-health-tab"
import { ReleaseMetricDetailsPage } from "./metrics/release-metric-details-page"
import { ReleaseMetricSourceBindingPage } from "./metrics/release-metric-source-binding-page"
import { ReleaseHealthOverviewPage } from "./overview/release-health-overview-page"
import { HealthSessionDetailsPage } from "./sessions/health-session-details-page"

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

  it("keeps a shared metric free of a standalone health verdict", () => {
    render(
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
      screen.getByRole("heading", { name: "API P95 latency" })
    ).toBeVisible()
    expect(
      screen.getByText(
        /This page shows value, trend, freshness, and Data status/
      )
    ).toBeVisible()
    expect(screen.getByText("Environment trend")).toBeVisible()
    expect(screen.getByText("Environment streams")).toBeVisible()
    expect(screen.getByText("Not connected")).toBeVisible()
    expect(screen.getByText("No data")).toBeVisible()
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

  it("configures an environment source through the four-step PromQL flow", () => {
    render(
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
      screen.getByRole("heading", { name: "Manage data source" })
    ).toBeVisible()
    expect(screen.getByText("Provider and connection")).toBeVisible()
    expect(screen.getByText("Query and schedule")).toBeVisible()
    expect(screen.getAllByText("Validate and preview")).toHaveLength(2)
    expect(screen.getByText("Review and save")).toBeVisible()
    expect(screen.getByLabelText("PromQL")).toBeVisible()
    expect(screen.getByText("query_range · range")).toBeVisible()
    expect(screen.queryByLabelText("Feature flag")).not.toBeInTheDocument()
    expect(screen.queryByText("Observation scope")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Detected context capabilities")
    ).not.toBeInTheDocument()
  })

  it("shows monitor rules in the selected metric unit", () => {
    render(
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
      screen.getByRole("heading", { name: "Checkout error rate" })
    ).toBeVisible()
    expect(screen.getAllByText("> 2% for 5 min").length).toBeGreaterThan(0)
    expect(screen.getAllByText("> 3% for 10 min").length).toBeGreaterThan(0)
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
