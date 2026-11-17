import { expect, test } from "@playwright/test"

test("loads the frontend with a reachable container API", async ({
  page,
}, testInfo) => {
  const apiUrl = testInfo.config.metadata.containerApiUrl
  test.skip(!apiUrl, "Requires the container E2E runner")

  // Use the actual runtime configuration and browser network, without API mocks.
  const ssoPreCheck = page.waitForResponse(
    (response) => response.url() === `${apiUrl}/api/v1/sso/pre-check`
  )
  await page.goto("/en/login")
  const apiResponse = await ssoPreCheck
  expect(apiResponse.ok()).toBe(true)
  expect(await apiResponse.json()).toMatchObject({ success: true })
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.env?.API_URL)).toBe(apiUrl)

  const readiness = await page.evaluate(async () => {
    const response = await fetch(`${window.env?.API_URL}/health/readiness`)
    return { status: response.status, body: await response.text() }
  })

  expect(readiness).toEqual({ status: 200, body: "Healthy" })
})
