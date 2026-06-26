import { expect, test } from "@playwright/test";
import {
  createLicense,
  mockContextEndpoints,
  mockContextEndpointsWithExpiredAccessToken,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext
} from "./helpers";

test.describe("layout", () => {
  test("persists sidebar collapse and exposes account preferences", async ({ page }) => {
    await mockRuntimeEnv(page, { VERSION: "2026.06.25" });
    await mockContextEndpoints(page);
    await setAuthenticatedUser(page);
    await setCurrentContext(page);

    await page.goto("/en/app");

    await expect(page.getByText("Layout User")).toBeVisible();
    await expect(page.getByText("Acme Corp")).toBeVisible();
    await expect(page.getByText("Commerce Apps")).toBeVisible();
    await expect(page.getByRole("button", { name: /生产环境/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Current Plan, Growth" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Teams" })).toHaveCount(0);
    await page.getByRole("button", { name: "IAM" }).click();
    await expect(page.getByRole("link", { name: "Teams" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Groups" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Policies" })).toBeVisible();
    await expect(page.getByRole("link", { name: "WebHooks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Access Tokens" })).toBeVisible();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    await expect(page.getByText("Feature Flags")).toHaveCount(0);
    await expect(page.getByText("Teams")).toHaveCount(0);
    await expect(page.getByText("WebHooks")).toHaveCount(0);
    await expect(page.evaluate(() => localStorage.getItem("featbit:sidebar-collapsed"))).resolves.toBe("true");

    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();

    await page.getByRole("button", { name: "Account" }).click();
    await expect(page.getByText("Version: 2026.06.25")).toBeVisible();
    await expect(page.getByText("Light")).toBeVisible();
    await expect(page.getByText("Language")).toBeVisible();
    await expect(page.getByText("EN", { exact: true })).toBeVisible();
    await page.getByText("Theme").hover();
    await expect(page.getByText("Dark")).toBeVisible();
    await expect(page.getByText("System")).toBeVisible();
  });

  test("switches project and environment using real project data", async ({ page }) => {
    await mockContextEndpoints(page);
    await setAuthenticatedUser(page);
    await setCurrentContext(page);

    await page.goto("/en/app");

    await page.getByRole("button", { name: /生产环境/ }).click();
    await expect(page.getByText("Growth Platform")).toBeVisible();
    await page.getByRole("menuitem", { name: "预发布环境" }).click();

    await expect(page.getByText("Growth Platform")).toBeVisible();
    await expect(page.getByRole("button", { name: /预发布环境/ })).toBeVisible();
    await expect(page.evaluate(() => JSON.parse(localStorage.getItem("current-project_test-user-id") ?? "{}"))).resolves.toMatchObject({
      projectId: "project-growth",
      projectName: "Growth Platform",
      envId: "env-staging-growth",
      envName: "预发布环境"
    });
  });

  test("keeps focus in the project and environment search field while typing", async ({ page }) => {
    await mockContextEndpoints(page);
    await setAuthenticatedUser(page);
    await setCurrentContext(page);

    await page.goto("/en/app");

    await page.getByRole("button", { name: /生产环境/ }).click();
    const searchInput = page.getByPlaceholder("Search environments");
    await searchInput.fill("P");

    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue("P");
  });

  test("refreshes an expired access token before loading context data", async ({ page }) => {
    await mockContextEndpointsWithExpiredAccessToken(page);
    await setAuthenticatedUser(page, { token: "expired-token" });
    await setCurrentContext(page);

    await page.goto("/en/app");

    await expect(page.getByText("Acme Corp")).toBeVisible();
    await expect(page.getByText("Commerce Apps")).toBeVisible();
    await expect(page.evaluate(() => localStorage.getItem("token"))).resolves.toBe("refreshed-token");
  });

  test("renders layout labels in Chinese for zh routes", async ({ page }) => {
    await mockContextEndpoints(page);
    await setAuthenticatedUser(page);
    await setCurrentContext(page);

    await page.goto("/zh/app");

    await expect(page.getByText("开关管理")).toBeVisible();
    await expect(page.getByText("当前订阅")).toBeVisible();
    await expect(page.getByRole("link", { name: "当前订阅，Growth" })).toBeVisible();
    await expect(page.getByText("内容将在后续迁移步骤中添加。")).toBeVisible();
  });

  test("renders SaaS free plan state from the workspace license", async ({ page }) => {
    await mockRuntimeEnv(page, { HOSTING_MODE: "saas" });
    await setAuthenticatedUser(page);
    await setCurrentContext(page);

    await page.route("**/api/v1/user/workspaces", async (route) => {
      await route.fulfill({
        json: { success: true, data: [{ id: "ws-1", key: "acme-workspace", name: "Acme Workspace", license: createLicense("free") }] }
      });
    });
    await page.route("**/api/v1/organizations**", async (route) => {
      await route.fulfill({
        json: { success: true, data: [{ id: "org-1", key: "acme-org", name: "Acme Corp", initialized: true }] }
      });
    });
    await page.route("**/api/v1/projects", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "project-commerce",
              name: "Commerce Apps",
              key: "commerce",
              environments: [{ id: "env-prod-cn", projectId: "project-commerce", name: "生产环境", key: "prod-cn", secrets: [], settings: {} }]
            }
          ]
        }
      });
    });

    await page.goto("/en/app");

    await expect(page.getByRole("link", { name: "Free Plan, Upgrade Now" })).toBeVisible();
  });
});

