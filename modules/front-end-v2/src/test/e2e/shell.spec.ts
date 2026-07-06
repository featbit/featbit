import { expect, test } from "@playwright/test"

test("renders the localized login shell", async ({ page }) => {
  await page.goto("/en/login")

  await expect(
    page.getByRole("heading", { name: "Login route ready" })
  ).toBeVisible()
})

test("renders the application shell placeholder", async ({ page }) => {
  await page.goto("/en/app")

  await expect(
    page.getByRole("heading", { name: "Application shell ready" })
  ).toBeVisible()
})
