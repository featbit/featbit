import { expect, test } from "@playwright/test"
import {
  createLicense,
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test.describe("workspace license", () => {
  test("renders license details and updates a self-hosted license", async ({
    page,
  }) => {
    await mockRuntimeEnv(page, {
      API_URL: "http://localhost:5000",
      HOSTING_MODE: "self-hosted",
      VERSION: "e2e",
    })
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    const currentLicense = createLicense("Growth")
    const updatedLicense = createLicense("Enterprise")

    await page.route("**/api/v1/workspaces", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: "ws-1",
            key: "acme-workspace",
            name: "Acme Workspace",
            license: currentLicense,
          },
        },
      })
    })

    await page.route("**/api/v1/workspaces/license", async (route) => {
      const payload = route.request().postDataJSON() as { license: string }
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: "ws-1",
            key: "acme-workspace",
            name: "Acme Workspace",
            license: payload.license,
          },
        },
      })
    })

    await page.goto("/en/app/workspace/license")

    await expect(page.getByRole("tab", { name: "License" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(page.getByRole("heading", { name: "License status" })).toBeVisible()
    await expect(page.getByText("Growth")).toBeVisible()
    await expect(page.getByText("Single sign-on")).toBeVisible()
    await expect(page.getByText("Granted").first()).toBeVisible()

    await page.getByRole("button", { name: "Replace" }).click()
    await page
      .getByPlaceholder("Enter your license here")
      .fill(updatedLicense)
    await page.getByRole("button", { name: "Update license" }).click()

    await expect(page.getByText("License updated!")).toBeVisible()
    await expect(page.getByRole("main").getByText("Enterprise")).toBeVisible()
    await expect(
      page.evaluate(() => localStorage.getItem("current-workspace_test-user-id"))
    ).resolves.toContain(updatedLicense)
  })
})
