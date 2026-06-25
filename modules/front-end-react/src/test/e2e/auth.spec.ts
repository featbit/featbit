import { expect, test, type Page } from "@playwright/test";

async function mockAuthEndpoints(
  page: Page,
  options: {
    loginResponse?: unknown;
    profileResponse?: unknown;
    ssoPreCheck?: unknown;
    socialProviders?: unknown;
  } = {}
) {
  const {
    loginResponse = { success: false },
    profileResponse = { success: true, data: { email: "test@featbit.com", name: "Test User" } },
    ssoPreCheck = { success: true, data: { isEnabled: true } },
    socialProviders = {
      success: true,
      data: [
        { name: "Google", authorizeUrl: "https://accounts.example.test/google" },
        { name: "GitHub", authorizeUrl: "https://accounts.example.test/github" },
        { name: "Okta", authorizeUrl: "https://accounts.example.test/okta" }
      ]
    }
  } = options;

  await page.route("**/api/v1/social/providers**", async (route) => {
    await route.fulfill({ json: socialProviders });
  });

  await page.route("**/api/v1/sso/pre-check", async (route) => {
    await route.fulfill({ json: ssoPreCheck });
  });

  await page.route("**/api/v1/identity/login-by-email", async (route) => {
    await route.fulfill({ json: loginResponse });
  });

  await page.route("**/api/v1/user/profile", async (route) => {
    await route.fulfill({ json: profileResponse });
  });
}

test.describe("login page", () => {
  test("renders the email login form and social sign-in options", async ({ page }) => {
    await mockAuthEndpoints(page);
    await page.goto("/en/login");

    await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Remember me" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Okta" })).toHaveCount(0);
  });

  test("pre-fills remembered email and remember-me state", async ({ page }) => {
    await mockAuthEndpoints(page);
    await page.addInitScript(() => {
      localStorage.setItem("remembered-email", "remembered@example.com");
    });

    await page.goto("/en/login");

    await expect(page.getByLabel("Email")).toHaveValue("remembered@example.com");
    await expect(page.getByRole("checkbox", { name: "Remember me" })).toBeChecked();
  });

  test("shows an inline error when email login is rejected", async ({ page }) => {
    await mockAuthEndpoints(page, {
      loginResponse: { success: false, errors: ["Email and/or password incorrect"] }
    });

    await page.goto("/en/login");
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("bad-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Email and/or password incorrect")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login$/);
  });

  test("stores auth state and opens the app after successful email login", async ({ page }) => {
    await mockAuthEndpoints(page, {
      loginResponse: { success: true, data: { token: "e2e-token" } }
    });

    await page.goto("/en/login");
    await page.getByLabel("Email").fill("test@featbit.com");
    await page.getByLabel("Password").fill("123456");
    await page.getByRole("checkbox", { name: "Remember me" }).check();
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/en\/app$/);
    await expect(page.getByRole("heading", { name: "Authenticated layout placeholder" })).toBeVisible();
    await expect(page.evaluate(() => localStorage.getItem("token"))).resolves.toBe("e2e-token");
    await expect(page.evaluate(() => localStorage.getItem("remembered-email"))).resolves.toBe("test@featbit.com");
  });

  test("navigates to SSO and back to email login", async ({ page }) => {
    await mockAuthEndpoints(page);

    await page.goto("/en/login");
    await page.getByRole("link", { name: "Sign in with SSO" }).click();

    await expect(page).toHaveURL(/\/en\/login\/sso$/);
    await expect(page.getByRole("heading", { name: "Sign in with SSO" })).toBeVisible();

    await page.getByRole("link", { name: "Back to sign in" }).click();

    await expect(page).toHaveURL(/\/en\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  });

  test("validates whitespace-only SSO workspace keys", async ({ page }) => {
    await mockAuthEndpoints(page);

    await page.goto("/en/login/sso");
    await page.getByLabel("Workspace key").fill("   ");
    await page.getByRole("button", { name: "Continue with SSO" }).click();

    await expect(page.getByText("Workspace key is required")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/login\/sso$/);
  });

  test("uses SSO pre-check workspace key as a locked field", async ({ page }) => {
    await mockAuthEndpoints(page, {
      ssoPreCheck: { success: true, data: { isEnabled: true, workspaceKey: "acme-prod" } }
    });

    await page.goto("/en/login/sso");

    await expect(page.getByLabel("Workspace key")).toHaveValue("acme-prod");
    await expect(page.getByLabel("Workspace key")).toBeDisabled();
  });
});
