import { expect, test } from "@playwright/test"

test("renders the localized login shell", async ({ page }) => {
  await page.goto("/en/login")

  await expect(page.getByText("Sign in to your workspace")).toBeVisible()
})

test("renders the application shell placeholder", async ({ page }) => {
  await page.route("**/api/v1/user/workspaces", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [{ id: "ws-real", key: "real", name: "Real Workspace" }],
      }),
    })
  })
  await page.route("**/api/v1/organizations?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [{ id: "org-real", key: "real-org", name: "Real Org" }],
      }),
    })
  })
  await page.route("**/api/v1/projects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: "project-real",
            key: "platform",
            name: "Real Platform",
            environments: [
              {
                id: "env-real",
                projectId: "project-real",
                key: "prod",
                name: "Real Production",
              },
            ],
          },
        ],
      }),
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem("token", "test-token")
    localStorage.setItem(
      "auth",
      JSON.stringify({
        id: "user-1",
        name: "Test User",
        email: "test@featbit.com",
      })
    )
  })

  await page.goto("/en")

  await expect(page.getByText("Real Org")).toBeVisible()
  await expect(page.getByText("Real Platform")).toBeVisible()
  await expect(page.getByText("Real Production")).toBeVisible()
  await expect(page.getByRole("link", { name: "Get Started" })).toBeVisible()
  await expect(
    page.getByText(
      "Authenticated layout ready. Page content will migrate in later steps."
    )
  ).toBeVisible()
})
