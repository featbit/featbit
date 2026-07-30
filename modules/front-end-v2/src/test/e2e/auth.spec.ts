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
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible()
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("checkbox", { name: "Remember email" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Google" })).toBeVisible()
    await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Okta" })).toHaveCount(0)
    await expect(page.getByText("Forgot password?")).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "https://www.featbit.co/privacy"
    )
    await expect(page.getByRole("link", { name: "Help" })).toHaveAttribute(
      "href",
      "https://docs.featbit.co"
    )
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

    const emailBounds = await page
      .getByLabel("Email", { exact: true })
      .boundingBox()
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

  test("pre-fills remembered email and remember-email state", async ({
    page,
  }) => {
    await mockAuthEndpoints(page)
    await page.addInitScript(() => {
      localStorage.setItem("remembered-email", "remembered@example.com")
    })

    await page.goto("/en/login")

    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "remembered@example.com"
    )
    await expect(
      page.getByRole("checkbox", { name: "Remember email" })
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
    await page.getByLabel("Email", { exact: true }).fill("wrong@example.com")
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
    await page.getByLabel("Email", { exact: true }).fill("test@featbit.com")
    await page.getByLabel("Password", { exact: true }).fill("123456")
    await page.getByRole("checkbox", { name: "Remember email" }).check()
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
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await route.fulfill({
        json: { success: true, data: { token: "social-token" } },
      })
    })

    await page.goto(
      "/login?social-logged-in=true&code=google-code&state=Google"
    )

    await expect(
      page.getByRole("heading", { name: "Completing sign-in" })
    ).toBeVisible()
    await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0)
    await expect(page).toHaveURL(/\/en$/)
    await expect(
      page.evaluate(() => localStorage.getItem("token"))
    ).resolves.toBe("social-token")
  })

  test("shows a safe localized message when an external callback fails", async ({
    page,
  }) => {
    await mockAuthEndpoints(page)
    let callbackRequests = 0
    await page.route("**/api/v1/social/login", async (route) => {
      callbackRequests += 1
      await route.fulfill({
        json: { success: false, errors: ["raw provider detail"] },
      })
    })

    await page.goto(
      "/en/login?social-logged-in=true&code=bad-code&state=Google"
    )

    await expect.poll(() => callbackRequests).toBe(1)
    await expect(
      page.getByText("We couldn't complete sign-in. Please try again.")
    ).toBeVisible()
    await expect(page.getByText("raw provider detail")).toHaveCount(0)
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible()
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
    const workspaceKey = page.getByLabel("Workspace key")
    await workspaceKey.fill("   ")
    await page.getByRole("button", { name: "Continue with SSO" }).click()

    await expect(page.getByText("Workspace key is required")).toBeVisible()
    await expect(workspaceKey).toHaveAttribute("aria-invalid", "true")
    await expect(workspaceKey).toBeFocused()
    await expect(page).toHaveURL(/\/en\/login\/sso$/)
  })

  test("uses the SSO pre-check workspace key as a read-only field", async ({
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
    await expect(page.getByLabel("Workspace key")).toHaveAttribute("readonly")
    await expect(page.getByLabel("Workspace key")).toBeEnabled()
    await expect(
      page.getByText("Configured for this installation.")
    ).toBeVisible()
  })

  test("hides disabled SSO and protects the dedicated route", async ({
    page,
  }) => {
    await mockAuthEndpoints(page, {
      ssoPreCheck: {
        success: true,
        data: { isEnabled: false, workspaceKey: "" },
      },
    })

    await page.goto("/en/login")

    await expect(
      page.getByRole("button", { name: "Sign in with SSO" })
    ).toHaveCount(0)
    await expect(page.getByText("Enterprise sign-in")).toHaveCount(0)

    await page.goto("/en/login/sso")

    await expect(page).toHaveURL(/\/en\/login\?reason=sso-unavailable$/)
    await expect(page.getByText("SSO isn't available")).toBeVisible()
  })

  test("recovers when the SSO availability check fails", async ({ page }) => {
    await mockAuthEndpoints(page)
    await page.unroute("**/api/v1/sso/pre-check")
    let requestCount = 0
    await page.route("**/api/v1/sso/pre-check", async (route) => {
      requestCount += 1

      if (requestCount === 1) {
        await route.fulfill({ status: 503, body: "Unavailable" })
        return
      }

      await route.fulfill({
        json: { success: true, data: { isEnabled: true } },
      })
    })

    await page.goto("/en/login/sso")

    await expect(
      page.getByRole("heading", {
        name: "We couldn't check SSO availability",
      })
    ).toBeVisible()
    await page.getByRole("button", { name: "Retry" }).click()
    await expect(
      page.getByRole("heading", { name: "Sign in with SSO" })
    ).toBeVisible()
  })

  test("preserves the reason and hash when switching languages", async ({
    page,
  }) => {
    await mockAuthEndpoints(page)
    await page.goto("/en/login?reason=permission-denied#details")

    await page.getByRole("link", { name: "中文" }).click()

    await expect(page).toHaveURL(
      /\/zh\/login\?reason=permission-denied#details$/
    )
    await expect(page.getByText("权限不足")).toBeVisible()
  })

  test("keeps the auth header unclipped at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await mockAuthEndpoints(page)
    await page.goto("/en/login")

    await expect(page.getByRole("link", { name: "FeatBit" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Switch to dark theme" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "EN" })).toBeVisible()
    await expect(page.getByRole("link", { name: "中文" })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
  })
})
