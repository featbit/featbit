import { expect, test } from "@playwright/test"

test("renders the localized login shell", async ({ page }) => {
  await page.goto("/en/login")

  await expect(page.getByText("Sign in to your workspace")).toBeVisible()
})

test("renders the application shell placeholder", async ({ page }) => {
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

  await page.goto("/en/app")

  await expect(page.getByText("Acme Corp")).toBeVisible()
  await expect(page.getByText("Growth Platform")).toBeVisible()
  await expect(page.getByRole("link", { name: "Get Started" })).toBeVisible()
  await expect(
    page.getByText(
      "Authenticated layout ready. Page content will migrate in later steps."
    )
  ).toBeVisible()
})
