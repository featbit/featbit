import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import {
  createLicense,
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

async function setupBillingPage(page: Page) {
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "saas",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)
  await setCurrentContext(page)

  await page.route("**/api/v1/workspaces", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          id: "ws-1",
          key: "acme-workspace",
          name: "Acme Workspace",
          license: createLicense("Growth"),
        },
      },
    })
  })

  await page.route("**/api/v1/billing/subscription", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          plan: "Growth",
          billingCycle: "monthly",
          baseMau: 40000,
          mau: 60000,
          usage: { mau: 18000 },
          addOnFeatures: ["Fine-grained Access Control"],
          currentPeriodStart: "2026-07-01T00:00:00.000Z",
          currentPeriodEnd: "2026-08-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
    })
  })

  await page.route("**/api/v1/billing/current-cycle", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          mau: 18000,
          start: "2026-07-01T00:00:00.000Z",
          end: "2026-08-01T00:00:00.000Z",
        },
      },
    })
  })

  await page.route("**/api/v1/billing/billing-information", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          companyName: "FeatBit Labs",
          contactEmail: "billing@featbit.test",
          address: "100 Release Ave",
          addressLine2: "Suite 8",
          taxId: "TAX-123",
          country: "US",
        },
      },
    })
  })

  await page.route("**/api/v1/billing/invoices", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "inv-1",
            billingDate: "2026-07-01T00:00:00.000Z",
            plan: "Growth",
            status: "paid",
            amountPaid: 20900,
            currency: "USD",
          },
        ],
      },
    })
  })
}

test.describe("workspace billing", () => {
  test("renders subscription, billing information, and invoices", async ({
    page,
  }) => {
    await setupBillingPage(page)

    await page.goto("/en/app/workspace/billing")

    await expect(page.getByRole("tab", { name: "Billing" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(page.getByRole("heading", { name: "Growth" })).toBeVisible()
    await expect(page.getByText("18,000 of 60,000 used")).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Billing information" })
    ).toBeVisible()
    await expect(page.getByText("FeatBit Labs")).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Invoice history" })
    ).toBeVisible()
    await expect(page.getByText("$209.00")).toBeVisible()
  })
})
