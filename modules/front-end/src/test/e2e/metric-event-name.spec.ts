import { expect, test } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

for (const width of [1366, 1920]) {
  test(`metric event names are shown, created, and edited at ${width}px`, async ({
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
    const items: Record<string, unknown>[] = []
    await page.route("**/api/v1/envs/*/experiment-metrics**", async (route) => {
      const request = route.request()
      if (request.method() === "POST") {
        const body = request.postDataJSON()
        expect(body.key).toBe("purchase-conversion")
        expect(body.eventName).toBe("purchase")
        const metric = {
          ...body,
          id: "metric-1",
          envId: "env-prod-cn",
          status: "active",
          experimentUsage: [],
          createdAt: "2026-09-15T00:00:00Z",
          updatedAt: "2026-09-15T00:00:00Z",
        }
        items.push(metric)
        await route.fulfill({ json: { success: true, data: metric } })
      } else if (request.method() === "PUT") {
        const body = request.postDataJSON()
        expect(body.key).toBeUndefined()
        expect(body.eventName).toBe("purchase_completed")
        Object.assign(items[0], body)
        await route.fulfill({ json: { success: true, data: items[0] } })
      } else {
        await route.fulfill({
          json: { success: true, data: { items, totalCount: items.length } },
        })
      }
    })

    await page.goto("/en/metrics")
    await page
      .getByRole("button", { name: "New metric", exact: true })
      .first()
      .click()
    const dialog = page.getByRole("dialog")
    await dialog
      .getByLabel("Name *", { exact: true })
      .fill("Purchase conversion")
    await expect(dialog.getByLabel("Key *", { exact: true })).toHaveValue(
      "purchase-conversion"
    )
    await expect(
      dialog.getByRole("button", { name: "Create metric", exact: true })
    ).toBeDisabled()
    await dialog.getByLabel("Event name *", { exact: true }).fill("purchase")
    await expect(
      dialog.getByRole("button", { name: "Create metric", exact: true })
    ).toBeEnabled()
    await dialog.screenshot({
      path: testInfo.outputPath("metric-event-name-form.png"),
    })
    const created = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/experiment-metrics") &&
        response.ok()
    )
    await dialog
      .getByRole("button", { name: "Create metric", exact: true })
      .click()
    await created
    await expect(dialog).not.toBeVisible()
    await expect(
      page.getByRole("columnheader", { name: "Event name", exact: true })
    ).toBeVisible()
    const row = page
      .getByRole("row")
      .filter({ has: page.getByText("Purchase conversion", { exact: true }) })
    await expect(row.getByText("purchase", { exact: true })).toBeVisible()
    await expect(
      row.getByText("purchase-conversion", { exact: true })
    ).toBeVisible()
    await row.getByRole("button", { name: "Edit", exact: true }).click()
    await expect(dialog.getByLabel("Key", { exact: true })).toHaveAttribute(
      "readonly",
      ""
    )
    await expect(
      dialog.getByLabel("Event name *", { exact: true })
    ).toHaveValue("purchase")
    await dialog
      .getByLabel("Event name *", { exact: true })
      .fill("purchase_completed")
    const updated = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().endsWith("/experiment-metrics/metric-1") &&
        response.ok()
    )
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click()
    await updated
    await expect(dialog).not.toBeVisible()
    await expect(
      row.getByText("purchase_completed", { exact: true })
    ).toBeVisible()
    await page.reload()
    await expect(
      row.getByText("purchase_completed", { exact: true })
    ).toBeVisible()
    await expect(
      row.getByRole("button", { name: "Archive", exact: true })
    ).toBeInViewport({ ratio: 1 })
    await page.screenshot({
      path: testInfo.outputPath("metrics-event-name-list.png"),
      fullPage: true,
    })
  })
}
