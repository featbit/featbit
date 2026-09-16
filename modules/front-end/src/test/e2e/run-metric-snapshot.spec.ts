import { expect, test } from "@playwright/test"
import type { ExperimentDetail } from "@/features/expts/details/experiment-details-types"
import type { MeasuringRun } from "@/features/expts/details/measuring/measuring-types"
import type { PrimaryMetricConfig } from "@/features/expts/details/metric-config-types"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

for (const width of [1366, 1920]) {
  test(`runs read their own metric snapshots at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await mockRuntimeEnv(page, {
      API_URL: "http://localhost:5000",
      HOSTING_MODE: "self-hosted",
      VERSION: "e2e",
    })
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    const snapshot: PrimaryMetricConfig = {
      metricId: "metric-1",
      metricKey: "payment-conversion",
      name: "Payment conversion",
      eventName: "purchase_v1",
      description: "Original payment completion definition",
      metricType: "binary",
      metricAgg: "once",
      expectedDirection: "increase_good",
    }
    const run: MeasuringRun = {
      id: "run-1",
      slug: "run-1",
      method: "bayesian_ab",
      primaryMetric: snapshot,
      guardrailMetrics: [],
      controlVariant: "control",
      treatmentVariant: "treatment",
      observationStart: "2026-09-01T00:00:00Z",
      observationEnd: "2026-09-02T00:00:00Z",
      analysisResult: JSON.stringify({
        type: "bayesian",
        primary_metric: {
          rows: [],
          metric_type: "proportion",
          metric_agg: "once",
        },
        guardrails: [],
      }),
      decision: null,
      decisionSummary: null,
      decisionReason: null,
      whatChanged: null,
      whatHappened: null,
      confirmedOrRefuted: null,
      whyItHappened: null,
      nextHypothesis: null,
      createdAt: "2026-09-01T00:00:00Z",
    }
    const current: ExperimentDetail = {
      id: "experiment-1",
      name: "Checkout experiment",
      description: null,
      envId: "env-prod-cn",
      flagId: "flag-1",
      flagKey: "checkout",
      flagName: "Checkout",
      stage: "measuring",
      runCount: 1,
      hypothesis: null,
      goal: null,
      intent: null,
      change: null,
      constraints: null,
      conflictAnalysis: null,
      lastLearning: null,
      primaryMetric: {
        ...snapshot,
        eventName: "purchase_v2",
        description: "Updated definition",
      },
      guardrailMetrics: [],
      experimentRuns: [run],
      createdAt: run.createdAt,
      updatedAt: run.createdAt,
    }
    await page.route("**/feature-flags/by-id/flag-1", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            id: "flag-1",
            key: "checkout",
            name: "Checkout",
            isEnabled: true,
            variations: [
              { id: "control", name: "Original", value: "false" },
              { id: "treatment", name: "Updated", value: "true" },
            ],
            fallthrough: { includedInExpt: false, variations: [] },
            targetUsers: [],
            rules: [],
            tags: [],
          },
        },
      })
    )
    await page.route("**/experiment-layers**", (route) =>
      route.fulfill({
        json: { success: true, data: { items: [], totalCount: 0 } },
      })
    )
    await page.route("**/api/v1/envs/*/experiments/experiment-1", (route) =>
      route.fulfill({
        json: { success: true, data: current },
      })
    )
    const runUpdates: Record<string, unknown>[] = []
    await page.route(
      "**/api/v1/envs/*/experiments/experiment-1/runs**",
      (route) => {
        if (route.request().method() === "POST") {
          current.experimentRuns.unshift({
            ...run,
            id: "run-2",
            slug: "run-2",
            primaryMetric: { ...current.primaryMetric! },
          } as MeasuringRun)
          current.runCount = 2
        } else if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON()
          runUpdates.push(body)
          Object.assign(current.experimentRuns[0]!, body)
        }
        return route.fulfill({ json: { success: true, data: current } })
      }
    )

    await page.goto("/en/experiments/experiment-1?stage=measuring")
    await expect(
      page.getByText("Original payment completion definition", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "Primary metric · purchase_v1",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Analyze latest data", exact: true })
    ).toBeEnabled()
    await page.getByRole("button", { name: "New run", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByText(/Payment conversion \(purchase_v2\)/)
    ).toBeVisible()
    await expect(
      dialog.getByText(/later changes apply to new runs/)
    ).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Create run", exact: true })
    ).toBeEnabled()
    const bounds = await dialog.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    await page.screenshot({
      path: testInfo.outputPath(`new-run-snapshot-${width}.png`),
    })

    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/runs/run-2/observation-window") &&
        response.request().method() === "PUT" &&
        response.ok()
    )
    await dialog
      .getByRole("button", { name: "Create run", exact: true })
      .click()
    await saved
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText("Updated definition", { exact: true })
    ).toBeVisible()
    expect(runUpdates).toHaveLength(2)
    for (const update of runUpdates) {
      expect(update).not.toHaveProperty("primaryMetric")
      expect(update).not.toHaveProperty("guardrailMetrics")
    }

    current.primaryMetric = null
    current.experimentRuns = [run]
    await page.reload()
    await expect(
      page.getByText("Original payment completion definition", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Analyze latest data", exact: true })
    ).toBeEnabled()
    await page.getByRole("button", { name: "New run", exact: true }).click()
    await expect(
      dialog.getByText(
        "Configure a primary metric for this experiment before creating a run."
      )
    ).toBeVisible()
    await expect(
      dialog.getByRole("button", { name: "Create run", exact: true })
    ).toBeDisabled()
  })
}
