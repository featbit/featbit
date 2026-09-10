import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import type { BillingSubscription } from "../../features/workspace/billing/billing-api"
import {
  createLicense,
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

async function setupBillingPage(
  page: Page,
  subscription: Partial<BillingSubscription> = {}
) {
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
          ...subscription,
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
  const paymentUrl = "https://invoice.stripe.com/i/billing-test"

  test("offers the available payment link in a separate tab", async ({
    page,
  }) => {
    await setupBillingPage(page, {
      status: "payment_failed",
      retryPaymentState: "available",
      retryPaymentUrl: paymentUrl,
    })
    await page.goto("/en/workspace/billing")

    const alert = page.getByRole("alert").filter({ hasText: "Payment failed" })
    await expect(alert).toBeVisible()
    const pay = alert.getByRole("link", { name: "Pay now" })
    await expect(pay).toHaveAttribute("href", paymentUrl)
    await expect(pay).toHaveAttribute("target", "_blank")
    await expect(pay).toHaveAttribute("rel", /noopener/)
    await expect(
      alert.getByRole("button", { name: "Refresh status" })
    ).toBeEnabled()

    await page
      .context()
      .route(paymentUrl, (route) => route.fulfill({ body: "Invoice preview" }))
    const popupPromise = page.waitForEvent("popup")
    await pay.click()
    const popup = await popupPromise
    await expect(popup).toHaveURL(paymentUrl)
    await popup.close()
  })

  test("retries an unavailable payment link without offering a stale URL", async ({
    page,
  }) => {
    const subscription: Partial<BillingSubscription> = {
      status: "payment_failed",
      retryPaymentState: "unavailable",
      retryPaymentUrl: paymentUrl,
    }
    await setupBillingPage(page, subscription)
    await page.goto("/en/workspace/billing")

    const alert = page.getByRole("alert").filter({ hasText: "Payment failed" })
    await expect(alert).toContainText(
      "The payment link is temporarily unavailable."
    )
    await expect(page.getByRole("link", { name: "Pay now" })).toHaveCount(0)
    subscription.retryPaymentState = "available"
    await alert.getByRole("button", { name: "Retry payment link" }).click()
    await expect(alert.getByRole("link", { name: "Pay now" })).toHaveAttribute(
      "href",
      paymentUrl
    )
    await expect(alert).not.toContainText(
      "The payment link is temporarily unavailable."
    )
  })

  test("shows synchronization guidance when no open invoice remains", async ({
    page,
  }) => {
    await setupBillingPage(page, {
      status: "payment_failed",
      retryPaymentState: "no_open_invoice",
      retryPaymentUrl: null,
    })
    await page.goto("/en/workspace/billing")

    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Syncing subscription status" })
    await expect(alert).toContainText("No outstanding invoice was found.")
    await expect(
      alert.getByRole("button", { name: "Refresh status" })
    ).toBeEnabled()
    await expect(page.getByText("Payment failed", { exact: true })).toHaveCount(
      0
    )
    await expect(page.getByRole("link", { name: "Pay now" })).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Retry payment link" })
    ).toHaveCount(0)
    await expect(
      page.getByText("Payment confirmed.", { exact: true })
    ).toHaveCount(0)
  })

  test("removes repayment guidance only after refresh confirms an active subscription", async ({
    page,
  }) => {
    const subscription: Partial<BillingSubscription> = {
      status: "payment_failed",
      retryPaymentState: "available",
      retryPaymentUrl: paymentUrl,
    }
    await setupBillingPage(page, subscription)
    await page.goto("/en/workspace/billing")
    const refresh = page.getByRole("button", {
      name: "Refresh status",
      exact: true,
    })
    await expect(refresh).toBeEnabled()

    subscription.status = "active"
    subscription.retryPaymentState = "not_required"
    subscription.retryPaymentUrl = null
    await refresh.click()

    await expect(
      page.getByText("Payment confirmed.", { exact: true })
    ).toBeVisible()
    await expect(page.getByText("Payment failed", { exact: true })).toHaveCount(
      0
    )
    await expect(page.getByRole("link", { name: "Pay now" })).toHaveCount(0)
    await expect(refresh).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "Growth", exact: true })
    ).toBeVisible()
  })

  test("reports failed refresh and allows recovery without claiming payment succeeded", async ({
    page,
  }) => {
    await setupBillingPage(page, {
      status: "payment_failed",
      retryPaymentState: "available",
      retryPaymentUrl: paymentUrl,
    })
    await page.goto("/en/workspace/billing")
    const refresh = page.getByRole("button", {
      name: "Refresh status",
      exact: true,
    })
    await expect(refresh).toBeEnabled()

    let fail = true
    await page.route("**/api/v1/billing/subscription", async (route) => {
      if (fail) {
        await route.fulfill({
          status: 500,
          json: { success: false, errors: ["InternalServerError"] },
        })
      } else {
        await route.fallback()
      }
    })
    await refresh.click()
    await expect(
      page.getByText("Unable to refresh payment status. Please try again.", {
        exact: true,
      })
    ).toBeVisible({ timeout: 15000 })
    await expect(
      page.getByText("Payment confirmed.", { exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole("alert").filter({ hasText: "Payment failed" })
    ).toBeVisible()
    await expect(refresh).toBeEnabled()

    fail = false
    await refresh.click()
    await expect(
      page.getByRole("heading", { name: "Growth", exact: true })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Pay now" })).toHaveAttribute(
      "href",
      paymentUrl
    )
  })

  test("renders subscription, billing information, and invoices", async ({
    page,
  }) => {
    await setupBillingPage(page)

    await page.goto("/en/workspace/billing")

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
