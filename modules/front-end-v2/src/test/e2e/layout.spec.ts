import { expect, test } from "@playwright/test"
import {
  createLicense,
  mockContextEndpoints,
  mockContextEndpointsWithExpiredAccessToken,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test.describe("layout", () => {
  test("persists sidebar collapse and exposes account preferences", async ({
    page,
  }) => {
    await mockRuntimeEnv(page, { VERSION: "2026.06.25" })
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    await page.goto("/en/app")

    await expect(page.getByText("Layout User")).toBeVisible()
    await expect(page.getByText("Acme Corp")).toBeVisible()
    await expect(page.getByText("Commerce Apps")).toBeVisible()
    await expect(page.getByRole("button", { name: /Production CN/ })).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Current Plan: Enterprise" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Team" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Groups" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Policies" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Webhooks" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Access Tokens" })).toBeVisible()

    await page.getByRole("button", { name: "Collapse sidebar" }).click()

    await expect(page.getByText("Feature Flags")).toHaveCount(0)
    await expect(page.getByText("Team")).toHaveCount(0)
    await expect(page.getByText("Webhooks")).toHaveCount(0)
    await expect(
      page.evaluate(() => localStorage.getItem("featbit:sidebar-collapsed"))
    ).resolves.toBe("true")

    await page.reload()
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible()

    await page.getByRole("button", { name: "Account" }).click()
    await expect(page.getByText("Version: 2026.06.25")).toBeVisible()
    await expect(page.getByText("Language")).toBeVisible()
    await expect(page.getByText("EN", { exact: true })).toBeVisible()
    await expect(page.getByText("System")).toBeVisible()
    await page.getByText("Theme").hover()
    await expect(page.getByText("Dark")).toBeVisible()
    await expect(page.getByText("Light")).toBeVisible()
  })

  test("switches project and environment using real project data", async ({
    page,
  }) => {
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    await page.goto("/en/app")

    await page.getByRole("button", { name: /Production CN/ }).click()
    await expect(page.getByText("Growth Platform")).toBeVisible()
    await page.getByRole("button", { name: "Staging" }).click()

    await expect(page.getByText("Growth Platform")).toBeVisible()
    await expect(page.getByRole("button", { name: /Staging/ })).toBeVisible()
    await expect(
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("current-project_test-user-id") ?? "{}")
      )
    ).resolves.toMatchObject({
      projectId: "project-growth",
      projectName: "Growth Platform",
      envId: "env-staging-growth",
      envName: "Staging",
    })
  })

  test("keeps focus in the project and environment search field while typing", async ({
    page,
  }) => {
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    await page.goto("/en/app")

    await page.getByRole("button", { name: /Production CN/ }).click()
    const searchInput = page.getByPlaceholder("Search environments...")
    await searchInput.fill("P")

    await expect(searchInput).toBeFocused()
    await expect(searchInput).toHaveValue("P")
  })

  test("refreshes an expired access token before loading context data", async ({
    page,
  }) => {
    await mockContextEndpointsWithExpiredAccessToken(page)
    await setAuthenticatedUser(page, { token: "expired-token" })
    await setCurrentContext(page)

    await page.goto("/en/app")

    await expect(page.getByText("Acme Corp")).toBeVisible()
    await expect(page.getByText("Commerce Apps")).toBeVisible()
    await expect(
      page.evaluate(() => localStorage.getItem("token"))
    ).resolves.toBe("refreshed-token")
  })

  test("renders SaaS free plan state from the workspace license", async ({
    page,
  }) => {
    await mockRuntimeEnv(page, { HOSTING_MODE: "saas" })
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    await page.route("**/api/v1/user/workspaces", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "ws-1",
              key: "acme-workspace",
              name: "Acme Workspace",
              license: createLicense("free"),
            },
          ],
        },
      })
    })
    await page.route("**/api/v1/organizations**", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "org-1",
              key: "acme-org",
              name: "Acme Corp",
              initialized: true,
            },
          ],
        },
      })
    })
    await page.route("**/api/v1/projects", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "project-commerce",
              name: "Commerce Apps",
              key: "commerce",
              environments: [
                {
                  id: "env-prod-cn",
                  projectId: "project-commerce",
                  name: "Production CN",
                  key: "prod-cn",
                },
              ],
            },
          ],
        },
      })
    })

    await page.goto("/en/app")

    await expect(
      page.getByRole("link", { name: "Free Plan: Upgrade Now" })
    ).toBeVisible()
  })
})
