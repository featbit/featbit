import { expect, test } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test("Evaluate paginates flags and filtered segments independently", async ({
  page,
}, testInfo) => {
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "self-hosted",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)
  await setCurrentContext(page)
  await page.route("**/api/v1/envs/*/end-user-properties", (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  )
  await page.route("**/api/v1/envs/*/end-users/list", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: [{ id: "user-1", keyId: "user-key", name: "Pagination user" }],
        },
      },
    })
  )
  await page.route("**/api/v1/envs/*/end-users/user-1/flags?*", (route) => {
    const params = new URL(route.request().url()).searchParams
    const size = Number(params.get("pageSize"))
    const offset = Number(params.get("pageIndex")) * size
    const flags = Array.from({ length: 11 }, (_, i) => ({
      name: `Flag ${i + 1}`,
      key: `flag-${i + 1}`,
      variationType: "boolean",
      variations: [{ value: "false" }],
      matchVariation: "false",
      matchReason: "default",
    })).filter((flag) => flag.name.includes(params.get("name") ?? ""))
    return route.fulfill({
      json: {
        success: true,
        data: {
          totalCount: flags.length,
          items: flags.slice(offset, offset + size),
        },
      },
    })
  })
  await page.route("**/api/v1/envs/*/end-users/user-1/segments", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: Array.from({ length: 11 }, (_, i) => ({
          id: `segment-${i + 1}`,
          name: `Segment ${i + 1}`,
          type: "environment-specific",
          scopes: [],
          updatedAt: "2026-09-04T08:00:00Z",
        })),
      },
    })
  )

  await page.goto("/en/end-users", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Evaluate", exact: true }).click()
  const sheet = page.getByRole("dialog", { name: "Evaluate", exact: true })
  const flags = sheet.getByRole("tabpanel", {
    name: "Feature Flags",
    exact: true,
  })
  await expect(flags.getByText("Flag 1", { exact: true })).toBeVisible()
  await expect(flags.getByRole("row")).toHaveCount(6)
  await flags.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(flags.getByText("Flag 6", { exact: true })).toBeVisible()
  await sheet.getByRole("tab", { name: "Segments", exact: true }).click()
  const segments = sheet.getByRole("tabpanel", {
    name: "Segments",
    exact: true,
  })
  await expect(segments.getByText("Segment 1", { exact: true })).toBeVisible()
  await expect(segments.getByRole("row")).toHaveCount(6)
  await segments.getByRole("button", { name: "3", exact: true }).click()
  await expect(segments.getByText("Segment 11", { exact: true })).toBeVisible()
  await expect(segments.getByRole("row")).toHaveCount(2)
  await expect(
    segments.getByRole("button", { name: "Next page", exact: true })
  ).toBeDisabled()
  await segments
    .getByPlaceholder("Filter by name", { exact: true })
    .fill("Segment 1")
  await expect(segments.getByText("Segment 1", { exact: true })).toBeVisible()
  await expect(
    segments.getByText("Showing 1 to 3 of 3 segments", { exact: true })
  ).toBeVisible()
  await expect(
    segments.getByRole("button", { name: "1", exact: true })
  ).toHaveAttribute("aria-current", "page")
  await segments.getByPlaceholder("Filter by name", { exact: true }).fill("")
  await segments.getByRole("combobox", { name: "Rows per page" }).click()
  await page.getByRole("option", { name: "10 / page", exact: true }).click()
  await expect(segments.getByRole("row")).toHaveCount(11)
  await segments.getByRole("button", { name: "2", exact: true }).click()
  await expect(
    segments.getByText("Showing 11 to 11 of 11 segments", { exact: true })
  ).toBeVisible()
  await expect(
    segments.getByRole("button", { name: "2", exact: true })
  ).toHaveAttribute("aria-current", "page")
  await expect(
    segments.getByRole("button", { name: "Next page", exact: true })
  ).toBeDisabled()
  await expect(
    segments.getByRole("button", { name: "Previous page", exact: true })
  ).toBeEnabled()
  await page.screenshot({
    path: testInfo.outputPath("evaluate-segments.png"),
    animations: "disabled",
  })
  await sheet.getByRole("tab", { name: "Feature Flags", exact: true }).click()
  await expect(flags.getByText("Flag 6", { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("evaluate-flags.png") })
  await flags.getByRole("combobox", { name: "Rows per page" }).click()
  await page.getByRole("option", { name: "10 / page", exact: true }).click()
  await expect(flags.getByText("Flag 1", { exact: true })).toBeVisible()
  await expect(flags.getByRole("row")).toHaveCount(11)
})
