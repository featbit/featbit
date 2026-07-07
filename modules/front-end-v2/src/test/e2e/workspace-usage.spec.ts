import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import {
  createLicense,
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

async function setupUsagePage(page: Page) {
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "saas",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)
  await setCurrentContext(page)

  await page.route("**/api/v1/workspaces", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          id: "ws-1",
          key: "acme-workspace",
          name: "Acme Workspace",
          license: createLicense("Growth"),
        },
      },
    })
  })

  await page.route("**/api/v1/billing/current-cycle", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          start: "2026-07-01T00:00:00.000Z",
          end: "2026-08-01T00:00:00.000Z",
        },
      },
    })
  })

  await page.route("**/api/v1/workspaces/usages**", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          summary: {
            uniqueUsers: 18420,
            totalFlagEvaluations: 7800000,
            totalCustomMetrics: 246000,
            prevUniqueUsers: 16450,
            prevFlagEvaluations: 7200000,
            prevCustomMetrics: 253000,
          },
          dailyTrend: [
            {
              date: "2026-07-01",
              newUsers: 620,
              flagEvaluations: 198000,
              customMetrics: 7200,
            },
            {
              date: "2026-07-02",
              newUsers: 710,
              flagEvaluations: 286000,
              customMetrics: 8300,
            },
            {
              date: "2026-07-03",
              newUsers: 840,
              flagEvaluations: 232000,
              customMetrics: 7900,
            },
          ],
          environmentUsages: [
            {
              orgName: "Acme Corp",
              projectName: "Growth Platform",
              envName: "Production",
              envId: "env-prod",
              uniqueUsers: 13120,
              flagEvaluations: 5600000,
              customMetrics: 176000,
            },
            {
              orgName: "Acme Corp",
              projectName: "Growth Platform",
              envName: "Staging",
              envId: "env-staging",
              uniqueUsers: 2850,
              flagEvaluations: 1100000,
              customMetrics: 38000,
            },
          ],
        },
      },
    })
  })
}

test.describe("workspace usage", () => {
  test("renders usage metrics, trend controls, and environment table", async ({
    page,
  }) => {
    await setupUsagePage(page)

    await page.goto("/en/app/workspace/usage")

    await expect(page.getByRole("tab", { name: "Usage" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(page.getByText("Jul 1, 2026 - Jul 31, 2026")).toBeVisible()
    await expect(
      page.getByRole("combobox", { name: "Current billing cycle" })
    ).toBeVisible()
    await expect(page.getByText("18.4K")).toBeVisible()
    await expect(page.getByText("7.8M")).toBeVisible()
    await expect(page.getByText("246K")).toBeVisible()

    await expect(page.getByText("Daily Trend")).toBeVisible()
    await page.getByRole("button", { name: "Custom Metrics" }).first().click()
    await expect(
      page.getByRole("button", { name: "Custom Metrics" }).first()
    ).toBeVisible()

    await expect(page.getByText("Per Environment")).toBeVisible()
    await expect(
      page.getByRole("row", { name: /Production Acme Corp/ })
    ).toBeVisible()
    await expect(page.getByRole("row", { name: /Staging Acme Corp/ })).toBeVisible()
    await expect(page.getByText("5,600,000")).toBeVisible()
    await expect(page.getByText("(71.8%)")).toBeVisible()
  })
})
