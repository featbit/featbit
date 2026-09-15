import { expect, test, type Page } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

const envId = "env-prod-cn"
const flags = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    key: "checkout",
    name: "Checkout flow",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    key: "checkout-next",
    name: "Next checkout",
  },
].map((flag) => ({
  ...flag,
  envId,
  isEnabled: true,
  isArchived: false,
  variationType: "boolean",
  variations: [
    { id: "control", name: "Control", value: "false" },
    { id: "treatment", name: "Treatment", value: "true" },
  ],
  disabledVariationId: "control",
  fallthrough: { includedInExpt: false, variations: [] },
  targetUsers: [],
  rules: [],
  tags: [],
}))

function experiment(flag: (typeof flags)[number] | null) {
  return {
    id: "experiment-1",
    name: "Checkout experiment",
    description: "Binding test",
    envId,
    flagId: flag?.id ?? null,
    flagKey: flag?.key ?? null,
    flagName: flag?.name ?? null,
    stage: "implementing",
    runCount: 0,
    runMethodSummary: null,
    stateSummary: { runs: [], hasLearning: false },
    experimentRuns: [],
    activities: [],
    hypothesis: null,
    goal: null,
    intent: null,
    change: null,
    constraints: null,
    conflictAnalysis: null,
    lastLearning: null,
    primaryMetric: null,
    guardrails: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  }
}

async function setup(page: Page) {
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "self-hosted",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)
  await setCurrentContext(page)
  await page.route("**/feature-flags/by-id/*", async (route) => {
    const flag = flags.find((item) => route.request().url().endsWith(item.id))
    await route.fulfill({
      status: flag ? 200 : 404,
      json: { success: Boolean(flag), data: flag },
    })
  })
}

test("flag filtering sends an ID, restores its key after reload, and clears", async ({
  page,
}) => {
  await setup(page)
  let availableOptions = flags
  await page.route(/\/api\/v1\/envs\/[^/]+\/feature-flags(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { items: availableOptions, totalCount: availableOptions.length },
      },
    })
  )
  await page.route(/\/api\/v1\/envs\/[^/]+\/experiments\?/, (route) => {
    const params = new URL(route.request().url()).searchParams
    expect(params.has("flagKey")).toBe(false)
    const items = [
      experiment(flags[0]!),
      {
        ...experiment(flags[1]!),
        id: "experiment-2",
        name: "Second experiment",
      },
    ].filter(
      (item) => !params.get("flagId") || item.flagId === params.get("flagId")
    )
    return route.fulfill({
      json: { success: true, data: { items, totalCount: items.length } },
    })
  })
  await page.goto("/en/experiments")
  await expect(
    page.getByText("Second experiment", { exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Feature flag", exact: true })
    .click()
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname.endsWith("/experiments") &&
      url.searchParams.get("flagId") === flags[0]!.id &&
      response.ok()
    )
  })
  await page.getByRole("option", { name: /Checkout flow/ }).click()
  await filtered
  await expect(page).toHaveURL(new RegExp(`flagId=${flags[0]!.id}`))
  await expect(
    page.getByText("Second experiment", { exact: true })
  ).toHaveCount(0)

  availableOptions = []
  await page.reload()
  const filter = page
    .getByRole("button", { name: "checkout", exact: true })
    .and(page.locator('[aria-haspopup="dialog"]'))
  await expect(filter).toBeVisible()
  await filter.click()
  await expect(
    page.getByText("No feature flag keys found", { exact: true })
  ).toBeVisible()
  await page.keyboard.press("Escape")
  const cleared = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname.endsWith("/experiments") &&
      !url.searchParams.has("flagId") &&
      response.ok()
    )
  })
  await page.getByRole("button", { name: "Clear feature flag filter" }).click()
  await cleared
  await expect(page).not.toHaveURL(/flagId=/)
  await expect(
    page.getByText("Second experiment", { exact: true })
  ).toBeVisible()
})

test("binding and changing a flag submit IDs while targeting links use keys", async ({
  page,
}) => {
  await setup(page)
  let current = experiment(null)
  const submissions: unknown[] = []
  await page.route(/\/api\/v1\/envs\/[^/]+\/feature-flags(?:\?|$)/, (route) =>
    route.fulfill({
      json: { success: true, data: { items: flags, totalCount: flags.length } },
    })
  )
  await page.route(
    "**/api/v1/envs/*/experiments/experiment-1",
    async (route) => {
      if (route.request().method() === "PUT") {
        const payload = route.request().postDataJSON()
        submissions.push(payload)
        current = experiment(
          flags.find((flag) => flag.id === payload.flagId) ?? null
        )
      }
      await route.fulfill({ json: { success: true, data: current } })
    }
  )
  await page.goto("/en/experiments/experiment-1?stage=exposure")
  for (const [index, flag] of flags.entries()) {
    await page
      .getByRole("button", {
        name: index ? "Change flag" : "Select flag",
        exact: true,
      })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("option", { name: new RegExp(flag.name) }).click()
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/experiments/experiment-1") &&
        response.request().method() === "PUT" &&
        response.ok()
    )
    await dialog
      .getByRole("button", { name: "Select flag", exact: true })
      .click()
    await saved
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Open targeting" })
    ).toHaveAttribute("href", `/en/feature-flags/${flag.key}/targeting`)
  }
  expect(submissions).toEqual(flags.map((flag) => ({ flagId: flag.id })))
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Open targeting" })
  ).toHaveAttribute("href", `/en/feature-flags/${flags[1]!.key}/targeting`)
})
