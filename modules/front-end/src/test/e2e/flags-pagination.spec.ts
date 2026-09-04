import { expect, test } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test.beforeEach(async ({ page }) => {
  await page.clock.install()
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "self-hosted",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)
  await setCurrentContext(page)
  await page.route("**/api/v1/envs/*/feature-flags/all-tags", (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  )
  await page.route("**/api/v1/envs/*/feature-flags?*", (route) => {
    const params = new URL(route.request().url()).searchParams
    const pageIndex = Number(params.get("pageIndex"))
    const pageSize = Number(params.get("pageSize"))
    const flags = Array.from({ length: 30 }, (_, index) => ({
      id: `flag-${index + 1}`,
      key: `flag-${index + 1}`,
      name: `Pagination flag ${index + 1}`,
      tags: [],
      isEnabled: true,
      variationType: "boolean",
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
    })).filter((flag) => flag.name.includes(params.get("name") ?? ""))
    return route.fulfill({
      json: {
        success: true,
        data: {
          totalCount: flags.length,
          items: flags.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
        },
      },
    })
  })
})

test("keeps the next page after the search debounce interval", async ({
  page,
}) => {
  await page.goto("/en/feature-flags", { waitUntil: "domcontentloaded" })
  await expect(
    page.getByText("Pagination flag 1", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(
    page.getByText("Pagination flag 11", { exact: true })
  ).toBeVisible()

  // Advance past the timer that previously reset the URL after navigation.
  await page.clock.runFor(1000)
  await expect(page).toHaveURL(/page=2/)
  await expect(
    page.getByText("Pagination flag 11", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(
    page.getByText("Pagination flag 21", { exact: true })
  ).toBeVisible()
  await page.clock.runFor(1000)
  await expect(page).toHaveURL(/page=3/)
})

test("preserves a direct page URL and resets only when the search changes", async ({
  page,
}) => {
  await page.goto("/en/feature-flags?name=Pagination&page=2", {
    waitUntil: "domcontentloaded",
  })
  await expect(
    page.getByText("Pagination flag 11", { exact: true })
  ).toBeVisible()
  await page.clock.runFor(1000)
  await expect(page).toHaveURL(/page=2/)

  await page.getByPlaceholder("Filter by name or key").fill("Pagination ")
  await page.clock.runFor(1000)
  await expect(page).toHaveURL(/page=2/)

  await page.getByPlaceholder("Filter by name or key").fill("Pagination flag 2")
  await page.clock.runFor(1000)
  await expect(page).not.toHaveURL(/[?&]page=/)
  await expect(
    page.getByText("Pagination flag 2", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("Pagination flag 11", { exact: true })
  ).toHaveCount(0)
})
