import type { Page } from "@playwright/test";

export async function mockAuthEndpoints(
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

export async function mockRuntimeEnv(page: Page, env: Record<string, string>) {
  const entries = Object.entries(env)
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(", ");

  await page.route("**/assets/env.js", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.env = { ${entries} };`
    });
  });
}

export async function setAuthenticatedUser(
  page: Page,
  user: {
    token?: string;
    email?: string;
    name?: string;
  } = {}
) {
  const { token = "e2e-token", email = "shell@featbit.com", name = "Shell User" } = user;

  await page.addInitScript(
    ({ token, email, name }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("auth", JSON.stringify({ email, name }));
    },
    { token, email, name }
  );
}
