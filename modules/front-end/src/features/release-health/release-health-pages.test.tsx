import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import "@/lib/i18n/i18n"
import { i18n } from "@/lib/i18n/i18n"
import type { FeatureFlag } from "@/features/flags/flags-types"
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

  it("configures an environment source without choosing a feature flag", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/en/release-health/metrics/api_p95_latency/source-bindings/production",
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
    expect(screen.getByText("Detected context capabilities")).toBeVisible()
    expect(screen.getByText("Feature flag key")).toBeVisible()
    expect(screen.getAllByText("Not checked")).toHaveLength(5)
    expect(screen.queryByLabelText("Feature flag")).not.toBeInTheDocument()
    expect(screen.queryByText("Observation scope")).not.toBeInTheDocument()
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
