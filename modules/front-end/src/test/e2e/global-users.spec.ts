import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import {
  createLicense,
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

function createLimitedLicense(features: string[]) {
  const payload = btoa(
    JSON.stringify({
      plan: "Growth",
      sub: "e2e",
      wsId: "ws-1",
      iat: Date.now(),
      exp: 4102444800000,
      issuer: "e2e",
      features,
    })
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  return `e2e.${payload}.signature`
}

async function setupGlobalUsersPage({
  page,
  license = createLicense("Growth"),
}: {
  page: Page
  license?: string
}) {
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "self-hosted",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)
  await setCurrentContext(page, license)

  await page.route("**/api/v1/user/workspaces", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "ws-1",
            key: "acme-workspace",
            name: "Acme Workspace",
            license,
          },
        ],
      },
    })
  })

  await page.route("**/api/v1/workspaces", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          id: "ws-1",
          key: "acme-workspace",
          name: "Acme Workspace",
          license,
        },
      },
    })
  })
}

async function mockGlobalUsers(page: Page) {
  await page.route("**/api/v1/global-users?*", async (route) => {
    const url = new URL(route.request().url())
    const name = url.searchParams.get("name")
    const users = [
      {
        id: "user-1",
        keyId: "user-alpha",
        name: "Alpha User",
        customizedProperties: [{ name: "department", value: "Sales" }],
      },
      {
        id: "user-2",
        keyId: "user-beta",
        name: "Beta User",
        customizedProperties: [{ name: "department", value: "Engineering" }],
      },
    ].filter((user) =>
      name ? user.name.toLowerCase().includes(name.toLowerCase()) : true
    )

    await route.fulfill({
      json: {
        success: true,
        data: {
          totalCount: users.length,
          items: users,
        },
      },
    })
  })
}

test.describe("workspace global users", () => {
  test("renders global users and custom columns", async ({ page }) => {
    await setupGlobalUsersPage({ page })
    await mockGlobalUsers(page)

    await page.goto("/en/workspace/global-users")

    await expect(
      page.getByRole("tab", { name: "Global Users" })
    ).toHaveAttribute("aria-selected", "true")
    await expect(page.getByText("Alpha User")).toBeVisible()
    await expect(page.getByText("Beta User")).toBeVisible()

    await page.getByRole("button", { name: /Display/ }).click()
    await page.getByText("department").click()
    await expect(page.getByText("Sales")).toBeVisible()
    await expect(page.getByText("Engineering")).toBeVisible()
  })

  test("filters by search term", async ({ page }) => {
    await setupGlobalUsersPage({ page })
    await mockGlobalUsers(page)

    await page.goto("/en/workspace/global-users")
    await page.getByPlaceholder("Search by name").fill("beta")

    await expect(page.getByText("Beta User")).toBeVisible()
    await expect(page.getByText("Alpha User")).toHaveCount(0)
  })

  test("shows license gate when global users is not enabled", async ({
    page,
  }) => {
    await setupGlobalUsersPage({
      page,
      license: createLimitedLicense(["sso"]),
    })

    await page.goto("/en/workspace/global-users")

    await expect(page.getByText("Global Users is not enabled")).toBeVisible()
    await expect(page.getByRole("link", { name: "Open License" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Import" })).toBeDisabled()
  })

  test("imports global users and shows success notification", async ({
    page,
  }) => {
    await setupGlobalUsersPage({ page })
    await mockGlobalUsers(page)
    await page.route("**/api/v1/global-users/upload", async (route) => {
      await route.fulfill({ json: { success: true, data: true } })
    })

    await page.goto("/en/workspace/global-users")
    await page.getByRole("button", { name: "Import" }).click()
    await page
      .locator('input[type="file"]')
      .setInputFiles("public/assets/upload-global-users.json")

    await expect(
      page.getByText("User data has been successfully imported.")
    ).toBeVisible()
  })

  test("opens user details and evaluate panels", async ({ page }) => {
    await setupGlobalUsersPage({ page })
    await mockGlobalUsers(page)
    await page.route(
      "**/api/v1/envs/*/end-users/user-1/flags?*",
      async (route) => {
        await route.fulfill({
          json: {
            success: true,
            data: {
              totalCount: 1,
              items: [
                {
                  name: "Checkout flow",
                  key: "checkout-flow",
                  variationType: "boolean",
                  variations: [],
                  matchVariation: "On",
                  matchReason: "Targeted",
                },
              ],
            },
          },
        })
      }
    )
    await page.route(
      "**/api/v1/envs/*/end-users/user-1/segments",
      async (route) => {
        await route.fulfill({
          json: {
            success: true,
            data: [
              {
                id: "segment-1",
                name: "Beta users",
                type: "shared",
                updatedAt: "2026-07-06T00:00:00.000Z",
              },
            ],
          },
        })
      }
    )

    await page.goto("/en/workspace/global-users")
    await page.getByRole("button", { name: "Details" }).first().click()
    const detailsDialog = page.getByRole("dialog", { name: "User profile" })
    await expect(detailsDialog).toBeVisible()
    const detailsDescription = detailsDialog.locator(
      '[data-slot="sheet-description"]'
    )
    await expect(
      detailsDescription.getByText("Alpha User", { exact: true })
    ).toBeVisible()
    await expect(detailsDescription.getByText("user-alpha")).toBeVisible()
    await expect(detailsDialog.locator("dd button")).toHaveCount(3)

    await detailsDialog.getByPlaceholder("Filter properties").fill("department")
    await expect(detailsDialog.getByText("department")).toBeVisible()
    await expect(detailsDialog.locator("dd button")).toHaveCount(1)

    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Evaluate" }).first().click()
    const evaluateDialog = page.getByRole("dialog", { name: "Evaluate" })
    await expect(evaluateDialog).toBeVisible()
    const evaluateDescription = evaluateDialog.locator(
      '[data-slot="sheet-description"]'
    )
    await expect(
      evaluateDescription.getByText("Alpha User", { exact: true })
    ).toBeVisible()
    await expect(evaluateDescription.getByText("user-alpha")).toBeVisible()
    await expect(evaluateDialog.getByText("Checkout flow")).toBeVisible()
    await evaluateDialog.getByRole("tab", { name: "Segments" }).click()
    await expect(evaluateDialog.getByText("Beta users")).toBeVisible()

    const detailsPopupPromise = page.waitForEvent("popup")
    await evaluateDialog.getByRole("button", { name: "Details" }).click()
    const detailsPopup = await detailsPopupPromise
    await expect(detailsPopup).toHaveURL("/en/segments/segment-1/targeting")
  })
})
