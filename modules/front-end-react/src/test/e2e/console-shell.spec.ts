import { expect, test } from "@playwright/test";
import { mockRuntimeEnv, setAuthenticatedUser } from "./helpers";

test.describe("console shell", () => {
  test("persists sidebar collapse and exposes account preferences", async ({ page }) => {
    await mockRuntimeEnv(page, { VERSION: "2026.06.25" });
    await setAuthenticatedUser(page);

    await page.goto("/en/app");

    await expect(page.getByText("Shell User")).toBeVisible();
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
});
