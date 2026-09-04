import { expect, test } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

for (const resource of ["experiments", "segments"] as const) {
  test(`${resource}: pagination stays put until the search actually changes`, async ({
    page,
  }) => {
    await page.clock.install()
    await mockRuntimeEnv(page, {
      API_URL: "http://localhost:5000",
      HOSTING_MODE: "self-hosted",
      VERSION: "e2e",
    })
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)
    await page.route(`**/api/v1/envs/*/${resource}?*`, (route) => {
      const params = new URL(route.request().url()).searchParams
      const pageIndex = Number(params.get("pageIndex"))
      const pageSize = Number(params.get("pageSize"))
      const items = Array.from({ length: 30 }, (_, index) => ({
        id: `item-${index + 1}`,
        key: `item-${index + 1}`,
        name: `Pagination item ${index + 1}`,
        description: "",
        stage: "hypothesis",
        flagKey: null,
        runCount: 0,
        runMethodSummary: null,
        type: "environment-specific",
        scopes: [],
        tags: [],
        included: [],
        excluded: [],
        rules: [],
        isArchived: false,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      })).filter((item) => item.name.includes(params.get("name") ?? ""))
      return route.fulfill({
        json: {
          success: true,
          data: {
            totalCount: items.length,
            items: items.slice(
              pageIndex * pageSize,
              (pageIndex + 1) * pageSize
            ),
          },
        },
      })
    })

    await page.goto(`/en/${resource}`, { waitUntil: "domcontentloaded" })
    await expect(
      page.getByText("Pagination item 1", { exact: true })
    ).toBeVisible()
    await page.getByRole("button", { name: "Next page", exact: true }).click()
    await expect(
      page.getByText("Pagination item 11", { exact: true })
    ).toBeVisible()
    await page.clock.runFor(1000)
    await expect(
      page.getByText("Pagination item 11", { exact: true })
    ).toBeVisible()

    const search = page.getByPlaceholder(
      resource === "experiments"
        ? "Filter by experiment name"
        : "Filter by name",
      { exact: true }
    )
    // Normalization leaves the effective search unchanged, so keep page 2.
    await search.fill(" ")
    await page.clock.runFor(1000)
    await expect(
      page.getByText("Pagination item 11", { exact: true })
    ).toBeVisible()

    await search.fill("Pagination item 2")
    await page.clock.runFor(1000)
    await expect(
      page.getByText("Pagination item 2", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText("Pagination item 11", { exact: true })
    ).toHaveCount(0)

    if (resource === "experiments") {
      await page.goto("/en/experiments?name=Pagination&page=2", {
        waitUntil: "domcontentloaded",
      })
      await expect(
        page.getByText("Pagination item 11", { exact: true })
      ).toBeVisible()
      await page.clock.runFor(1000)
      await expect(page).toHaveURL(/page=2/)
    }
  })
}
