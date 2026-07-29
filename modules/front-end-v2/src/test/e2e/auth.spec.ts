import { expect, test } from "@playwright/test"
import { mockAuthEndpoints, mockContextEndpoints } from "./helpers"

test.describe("login page", () => {
  test("renders the email login form and social sign-in options", async ({
    page,
  }) => {
    await mockAuthEndpoints(page)
    await page.goto("/en/login")

    await expect(
      page.getByRole("heading", { name: "Sign in to your workspace" })
    ).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("checkbox", { name: "Remember me" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Google" })).toBeVisible()
    await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Okta" })).toHaveCount(0)
  })

  test("keeps the login form centered at medium desktop widths", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await mockAuthEndpoints(page)
    await page.goto("/en/login")

    await expect(
      page.getByRole("heading", { name: "Release with confidence" })
    ).toBeHidden()

    const emailBounds = await page.getByLabel("Email").boundingBox()
    if (!emailBounds) {
      throw new Error("Email field is not visible")
    }

    expect(emailBounds.x).toBeGreaterThan(48)
    expect(emailBounds.x + emailBounds.width).toBeLessThan(1280 - 48)

    await page.setViewportSize({ width: 1536, height: 1024 })
    await expect(
      page.getByRole("heading", { name: "Release with confidence" })
    ).toBeVisible()
  })

  test("pre-fills remembered email and remember-me state", async ({ page }) => {
    await mockAuthEndpoints(page)
    await page.addInitScript(() => {
      localStorage.setItem("remembered-email", "remembered@example.com")
    })

    await page.goto("/en/login")

    await expect(page.getByLabel("Email")).toHaveValue("remembered@example.com")
    await expect(
      page.getByRole("checkbox", { name: "Remember me" })
    ).toBeChecked()
  })

  test("toggles password visibility", async ({ page }) => {
    await mockAuthEndpoints(page)

    await page.goto("/en/login")
    const passwordInput = page.getByLabel("Password", { exact: true })

    await expect(passwordInput).toHaveAttribute("type", "password")
    await page.getByRole("button", { name: "Show password" }).click()
    await expect(passwordInput).toHaveAttribute("type", "text")
    await page.getByRole("button", { name: "Hide password" }).click()
    await expect(passwordInput).toHaveAttribute("type", "password")
  })

  test("shows an inline error when email login is rejected", async ({
    page,
  }) => {
    await mockAuthEndpoints(page, {
      loginResponse: {
        success: false,
        errors: ["Email and/or password incorrect"],
      },
    })

    await page.goto("/en/login")
    await page.getByLabel("Email").fill("wrong@example.com")
    await page.getByLabel("Password", { exact: true }).fill("bad-password")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()

    await expect(
      page.getByText("Email and/or password incorrect")
    ).toBeVisible()
    await expect(page).toHaveURL(/\/en\/login$/)
  })

  test("stores auth state and opens the app after successful email login", async ({
    page,
  }) => {
    await mockAuthEndpoints(page, {
      loginResponse: { success: true, data: { token: "e2e-token" } },
    })
    await mockContextEndpoints(page)

    await page.goto("/en/login")
    await page.getByLabel("Email").fill("test@featbit.com")
    await page.getByLabel("Password", { exact: true }).fill("123456")
    await page.getByRole("checkbox", { name: "Remember me" }).check()
    await page.getByRole("button", { name: "Sign in", exact: true }).click()

    await expect(page).toHaveURL(/\/en$/)
    await expect(
      page.getByText(
        "Authenticated layout ready. Page content will migrate in later steps."
      )
    ).toBeVisible()
    await expect(page.getByText("Acme Corp")).toBeVisible()
    await expect(page.getByText("Growth Platform")).toBeVisible()
    await expect(page.getByRole("button", { name: "Production" })).toBeVisible()
    await expect(
      page.evaluate(() => localStorage.getItem("token"))
    ).resolves.toBe("e2e-token")
    await expect(
      page.evaluate(() => localStorage.getItem("remembered-email"))
    ).resolves.toBe("test@featbit.com")
  })

  test("handles a social login callback that returns to a non-localized path", async ({
    page,
  }) => {
    await mockAuthEndpoints(page)
    await mockContextEndpoints(page)
    await page.route("**/api/v1/social/login", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      await route.fulfill({
        json: { success: true, data: { token: "social-token" } },
      })
    })

    await page.goto(
      "/login?social-logged-in=true&code=google-code&state=Google"
    )

    await expect(page.getByText("Signing in...")).toBeVisible()
    await expect(page).toHaveURL(/\/en$/)
    await expect(
      page.evaluate(() => localStorage.getItem("token"))
    ).resolves.toBe("social-token")
  })

  test("navigates to SSO and back to email login", async ({ page }) => {
    await mockAuthEndpoints(page)

    await page.goto("/en/login")
    await page.getByRole("button", { name: "Sign in with SSO" }).click()

    await expect(page).toHaveURL(/\/en\/login\/sso$/)
    await expect(
      page.getByRole("heading", { name: "Sign in with SSO" })
    ).toBeVisible()

    await page.getByRole("button", { name: "Back to sign in" }).click()

    await expect(page).toHaveURL(/\/en\/login$/)
    await expect(
      page.getByRole("heading", { name: "Sign in to your workspace" })
    ).toBeVisible()
  })

  test("validates whitespace-only SSO workspace keys", async ({ page }) => {
    await mockAuthEndpoints(page)

    await page.goto("/en/login/sso")
    await page.getByLabel("Workspace key").fill("   ")
    await page.getByRole("button", { name: "Continue with SSO" }).click()

    await expect(page.getByText("Workspace key is required")).toBeVisible()
    await expect(page).toHaveURL(/\/en\/login\/sso$/)
  })

  test("uses SSO pre-check workspace key as a locked field", async ({
    page,
  }) => {
    await mockAuthEndpoints(page, {
      ssoPreCheck: {
        success: true,
        data: { isEnabled: true, workspaceKey: "acme-prod" },
      },
    })

    await page.goto("/en/login/sso")

    await expect(page.getByLabel("Workspace key")).toHaveValue("acme-prod")
    await expect(page.getByLabel("Workspace key")).toBeDisabled()
  })
})
