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

    await page.goto("/en")

    await expect(page.getByText("Layout User")).toBeVisible()
    await expect(page.getByText("Acme Corp")).toBeVisible()
    await expect(page.getByText("Commerce Apps")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Production CN/ })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Current Plan: Growth" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Groups" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Policies" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Webhooks" })).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Access Tokens" })
    ).toBeVisible()

    await page.getByRole("button", { name: "IAM" }).click()
    await expect(page.getByRole("link", { name: "Team" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Groups" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Policies" })).toBeVisible()

    await page.getByRole("button", { name: "Collapse sidebar" }).click()

    await expect(page.getByText("Feature Flags")).toHaveCount(0)
    await expect(page.getByText("Team")).toHaveCount(0)
    await expect(page.getByText("Webhooks")).toHaveCount(0)
    await expect(
      page.evaluate(() => localStorage.getItem("featbit:sidebar-collapsed"))
    ).resolves.toBe("true")

    await page.reload()
    await expect(
      page.getByRole("button", { name: "Expand sidebar" })
    ).toBeVisible()

    await page.getByRole("button", { name: "Account" }).click()
    await expect(page.getByText("Version: 2026.06.25")).toBeVisible()
    await expect(page.getByText("Language")).toBeVisible()
    await expect(page.getByText("EN", { exact: true })).toBeVisible()
    await expect(page.getByText("System")).toBeVisible()
    await page.getByText("Theme").hover()
    await expect(page.getByText("Dark")).toBeVisible()
    await expect(page.getByText("Light")).toBeVisible()
  })

  test("switches the app environment and returns to the current module root", async ({
    page,
  }) => {
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await page.addInitScript((license) => {
      const userId = "test-user-id"
      localStorage.setItem(
        `current-workspace_${userId}`,
        JSON.stringify({
          id: "ws-1",
          key: "acme-workspace",
          name: "Acme Workspace",
          license,
        })
      )
      localStorage.setItem(
        `current-organization_${userId}`,
        JSON.stringify({
          id: "org-1",
          key: "acme-org",
          name: "Acme Corp",
          initialized: true,
        })
      )

      const projectKey = `current-project_${userId}`
      if (!localStorage.getItem(projectKey)) {
        localStorage.setItem(
          projectKey,
          JSON.stringify({
            projectId: "project-commerce",
            projectName: "Commerce Apps",
            projectKey: "commerce",
            envId: "env-prod-cn",
            envKey: "prod-cn",
            envName: "Production CN",
          })
        )
      }
    }, createLicense("Growth"))

    await page.goto("/en/workspace/global-users")

    await page.getByRole("button", { name: /Production CN/ }).click()
    await expect(page.getByText("Growth Platform")).toBeVisible()
    await page.getByRole("option", { name: "Staging" }).click()

    await expect(page).toHaveURL(/\/en\/workspace$/)
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

  test("keeps explicit environment contexts isolated between tabs", async ({
    context,
    page,
  }) => {
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    await page.goto(
      "/en/feature-flags/checkout/targeting?context=environment&projectId=project-growth&envId=env-staging-growth"
    )
    await expect(page.getByRole("button", { name: /Staging/ })).toBeVisible()

    const otherPage = await context.newPage()
    await mockContextEndpoints(otherPage)
    await setAuthenticatedUser(otherPage)
    await setCurrentContext(otherPage)

    try {
      await otherPage.goto(
        "/en/feature-flags/checkout/targeting?context=environment&projectId=project-commerce&envId=env-dev-commerce"
      )
      await expect(
        otherPage.getByRole("button", { name: /Development/ })
      ).toBeVisible()

      await expect(
        page.evaluate(() =>
          JSON.parse(
            sessionStorage.getItem("current-project-tab_test-user-id") ?? "{}"
          )
        )
      ).resolves.toMatchObject({
        projectId: "project-growth",
        envId: "env-staging-growth",
      })
      await expect(
        otherPage.evaluate(() =>
          JSON.parse(
            sessionStorage.getItem("current-project-tab_test-user-id") ?? "{}"
          )
        )
      ).resolves.toMatchObject({
        projectId: "project-commerce",
        envId: "env-dev-commerce",
      })
      await expect(
        page.evaluate(() =>
          JSON.parse(
            localStorage.getItem("current-project_test-user-id") ?? "{}"
          )
        )
      ).resolves.toMatchObject({ envId: "env-prod-cn" })

      await page.reload()
      await otherPage.reload()

      await expect(page.getByRole("button", { name: /Staging/ })).toBeVisible()
      await expect(
        otherPage.getByRole("button", { name: /Development/ })
      ).toBeVisible()

      await otherPage.evaluate(() => {
        const channel = new BroadcastChannel("featbit-ui-broadcast-channel")
        channel.postMessage("env-changed")
        channel.close()
      })
      await expect(page.getByRole("button", { name: /Staging/ })).toBeVisible()

      await page.goto(
        "/en/feature-flags/checkout/targeting?context=environment&projectId=project-growth&envId=env-inaccessible"
      )
      await expect(
        page.getByRole("button", { name: /Production CN/ })
      ).toBeVisible()
      await expect(
        page.evaluate(() =>
          sessionStorage.getItem("current-project-tab_test-user-id")
        )
      ).resolves.toBeNull()
    } finally {
      await otherPage.close()
    }
  })

  test("marks only the current sidebar page as active", async ({ page }) => {
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    await page.goto("/en/feature-flags")

    await expect(page.getByRole("link", { name: "Feature Flags" })).toHaveClass(
      /(^|\s)bg-accent(\s|$)/
    )
    await expect(
      page.getByRole("link", { name: "Get Started" })
    ).not.toHaveClass(/(^|\s)bg-accent(\s|$)/)
    await expect(page.getByRole("button", { name: "IAM" })).not.toHaveClass(
      /(^|\s)bg-muted(\s|$)/
    )
  })

  test("keeps focus in the project and environment search field while typing", async ({
    page,
  }) => {
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    await page.goto("/en")

    await page.getByRole("button", { name: /Production CN/ }).click()
    const searchInput = page.getByRole("combobox")
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

    await page.goto("/en")

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

    await page.goto("/en")

    await expect(
      page.getByRole("link", { name: "Current Plan: Free" })
    ).toHaveAttribute("href", "/en/workspace/billing")
  })

  test("renders the global billing usage message when usage is high", async ({
    page,
  }) => {
    await mockRuntimeEnv(page, { HOSTING_MODE: "saas" })
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    await page.route("**/api/v1/billing/subscription", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            plan: "Growth",
            billingCycle: "monthly",
            mau: 60000,
            usage: { mau: 57000 },
          },
        },
      })
    })
    await page.route("**/api/v1/billing/current-cycle", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { mau: 57000 },
        },
      })
    })

    await page.goto("/en")

    await expect(page.getByText("Approaching usage limit")).toBeVisible()
    await expect(page.getByText(/57,000 of 60,000 MAU/)).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Upgrade plan" })
    ).toHaveAttribute("href", "/en/workspace/billing?open=pricing")
  })
})
