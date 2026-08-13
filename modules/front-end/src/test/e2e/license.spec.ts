import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import {
  createLicense,
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

function createCustomLicense({
  plan = "Growth",
  // 2100-01-01 UTC keeps the default test license safely active.
  expiresAt = 4102444800000,
  features = ["*"],
}: {
  plan?: string
  expiresAt?: number
  features?: string[]
} = {}) {
  const payload = btoa(
    JSON.stringify({
      plan,
      sub: "e2e",
      wsId: "ws-1",
      iat: Date.now(),
      exp: expiresAt,
      issuer: "e2e",
      features,
    })
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  return `e2e.${payload}.signature`
}

async function setupLicensePage({
  page,
  hostingMode = "self-hosted",
  license = createLicense("Growth"),
}: {
  page: Page
  hostingMode?: "self-hosted" | "saas"
  license?: string | null
}) {
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: hostingMode,
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)

  if (license === null) {
    await page.addInitScript(() => {
      const userId = "test-user-id"
      localStorage.setItem(
        `current-workspace_${userId}`,
        JSON.stringify({
          id: "ws-1",
          key: "acme-workspace",
          name: "Acme Workspace",
        })
      )
      localStorage.setItem(
        `current-organization_${userId}`,
        JSON.stringify({
          id: "org-1",
          key: "acme-org",
          name: "Acme Corp",
          initialized: true,
        })
      )
      localStorage.setItem(
        `current-project_${userId}`,
        JSON.stringify({
          projectId: "project-commerce",
          projectName: "Commerce Apps",
          projectKey: "commerce",
          envId: "env-prod-cn",
          envKey: "prod-cn",
          envName: "Production CN",
        })
      )
    })
    await page.route("**/api/v1/user/workspaces", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "ws-1",
              key: "acme-workspace",
              name: "Acme Workspace",
            },
          ],
        },
      })
    })
  } else {
    await setCurrentContext(page)
  }

  await page.route("**/api/v1/workspaces", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          id: "ws-1",
          key: "acme-workspace",
          name: "Acme Workspace",
          ...(license === null ? {} : { license }),
        },
      },
    })
  })

  if (hostingMode === "saas") {
    await page.route("**/api/v1/billing/subscription", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            plan: "Growth",
            billingCycle: "month",
            mau: 0,
            usage: { mau: 0 },
          },
        },
      })
    })
    await page.route("**/api/v1/billing/current-cycle", async (route) => {
      await route.fulfill({
        json: { success: true, data: { mau: 0 } },
      })
    })
  }
}

test.describe("workspace license", () => {
  test("renders a SaaS license summary without self-hosted update controls", async ({
    page,
  }) => {
    await setupLicensePage({
      page,
      hostingMode: "saas",
      license: createCustomLicense({ plan: "Growth" }),
    })

    await page.goto("/en/workspace/license")

    await expect(
      page.getByRole("heading", { name: "License status" })
    ).toBeVisible()
    await expect(page.getByRole("main").getByText("Growth")).toBeVisible()
    await expect(page.getByText("Active")).toBeVisible()
    await expect(page.getByRole("button", { name: "Replace" })).toHaveCount(0)
  })

  test("renders no-license guidance", async ({ page }) => {
    await setupLicensePage({ page, license: null })

    await page.goto("/en/workspace/license")

    await expect(page.getByText("No License Available")).toBeVisible()
    await expect(
      page.getByRole("link", {
        name: "Request a free trial or contact the FeatBit team.",
      })
    ).toHaveAttribute("href", "https://www.featbit.co/pricing")
    await expect(page.getByText("Not included").first()).toBeVisible()
  })

  test("renders expired and limited feature states", async ({ page }) => {
    await setupLicensePage({
      page,
      license: createCustomLicense({
        plan: "Growth",
        expiresAt: Date.parse("2026-07-05T00:00:00.000Z"),
        features: ["sso"],
      }),
    })

    await page.goto("/en/workspace/license")

    await expect(page.getByText("Expired")).toBeVisible()
    await expect(page.getByText("Single sign-on")).toBeVisible()
    await expect(page.getByText("Not included").first()).toBeVisible()
  })

  test("renders license details and updates a self-hosted license", async ({
    page,
  }) => {
    const currentLicense = createLicense("Growth")
    const updatedLicense = createLicense("Enterprise")

    await setupLicensePage({ page, license: currentLicense })

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

    await page.goto("/en/workspace/license")

    await expect(page.getByRole("tab", { name: "License" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(
      page.getByRole("heading", { name: "License status" })
    ).toBeVisible()
    await expect(page.getByRole("main").getByText("Growth")).toBeVisible()
    await expect(page.getByText("Single sign-on")).toBeVisible()
    await expect(page.getByText("Granted").first()).toBeVisible()

    await page.getByRole("button", { name: "Replace" }).click()
    await page.getByPlaceholder("Enter your license here").fill(updatedLicense)
    await page.getByRole("button", { name: "Update license" }).click()

    await expect(page.getByText("License updated!")).toBeVisible()
    await expect(page.getByRole("main").getByText("Enterprise")).toBeVisible()
    await expect(page.getByRole("button", { name: "Replace" })).toBeVisible()
    await expect(
      page.evaluate(() =>
        localStorage.getItem("current-workspace_test-user-id")
      )
    ).resolves.toContain(updatedLicense)
  })

  test("shows an invalid-license notification when update fails", async ({
    page,
  }) => {
    await setupLicensePage({ page, license: createLicense("Growth") })

    await page.route("**/api/v1/workspaces/license", async (route) => {
      await route.fulfill({
        status: 400,
        json: {
          success: false,
          errors: ["Invalid license"],
        },
      })
    })

    await page.goto("/en/workspace/license")

    await page.getByRole("button", { name: "Replace" }).click()
    await page
      .getByPlaceholder("Enter your license here")
      .fill("invalid-license")
    await page.getByRole("button", { name: "Update license" }).click()

    await expect(
      page.getByText(
        "Invalid license, please contact FeatBit team to get a license!"
      )
    ).toBeVisible()
    await expect(page.getByPlaceholder("Enter your license here")).toBeVisible()
  })
})
