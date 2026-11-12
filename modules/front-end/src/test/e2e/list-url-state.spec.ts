import { expect, test } from "@playwright/test"
import {
  createLicense,
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test.beforeEach(async ({ page }) => {
  await page.clock.install()
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "self-hosted",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)
  await setCurrentContext(page)
  await page.route("**/api/v1/workspaces", (route) =>
    route.fulfill({
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
  )
})

const lists = [
  [
    "feature-flags",
    "envs/*/feature-flags",
    "name",
    "status=on&archived=true",
    { isEnabled: "true", isArchived: "true" },
  ],
  [
    "segments",
    "envs/*/segments",
    "name",
    "archived=true",
    { isArchived: "true" },
  ],
  [
    "experiments",
    "envs/*/experiments",
    "name",
    "flagId=flag-one",
    { flagId: "flag-one" },
  ],
  ["iam/team", "members", "searchText", "", {}],
  ["iam/groups", "groups", "name", "", {}],
  ["iam/policies", "policies", "name", "", {}],
  [
    "access-tokens",
    "access-tokens",
    "name",
    "type=Service&creatorId=creator-one&creatorName=Alice",
    { type: "Service", creatorId: "creator-one" },
  ],
  ["relay-proxies", "relay-proxies", "name", "", {}],
  [
    "webhooks",
    "webhooks",
    "name",
    "projectId=project-one",
    { projectId: "project-one" },
  ],
  ["workspace/global-users", "global-users", "name", "", {}],
  [
    "metrics",
    "envs/*/experiment-metrics",
    "searchText",
    "archived=true",
    { status: "archived" },
  ],
  [
    "layers",
    "envs/*/experiment-layers",
    "searchText",
    "archived=true",
    { status: "archived" },
  ],
] as const

for (const [path, endpoint, searchKey, filters, apiFilters] of lists) {
  test(`${path}: restores pagination and filters on direct entry and refresh`, async ({
    page,
  }) => {
    const requests: URLSearchParams[] = []
    await page.route(`**/api/v1/${endpoint}?*`, (route) => {
      requests.push(new URL(route.request().url()).searchParams)
      return route.fulfill({
        json: { success: true, data: { items: [], totalCount: 100 } },
      })
    })
    const url = `/en/${path}?name=checkout&page=3&pageSize=20${filters ? `&${filters}` : ""}`
    await page.goto(url)
    await expect.poll(() => requests.length).toBeGreaterThan(0)
    await expect(page.locator('input[value="checkout"]')).toBeVisible()
    await page.clock.runFor(1000)
    expect(new URL(page.url()).searchParams.get("page")).toBe("3")
    const beforeRefresh = requests.length
    await page.reload()
    await expect.poll(() => requests.length).toBeGreaterThan(beforeRefresh)
    for (const request of requests) {
      expect(request.get("pageIndex")).toBe("2")
      expect(request.get("pageSize")).toBe("20")
      expect(request.get(searchKey)).toBe("checkout")
      for (const [key, value] of Object.entries(apiFilters))
        expect(request.get(key)).toBe(value)
    }
  })
}

test("segments: detail tabs and return restore the complete list URL", async ({
  page,
}) => {
  const segment = {
    id: "segment-one",
    key: "checkout",
    name: "Checkout",
    description: "",
    type: "environment-specific",
    scopes: [],
    tags: [],
    included: [],
    excluded: [],
    rules: [],
    isArchived: false,
  }
  await page.route("**/api/v1/envs/*/segments?*", (route) =>
    route.fulfill({
      json: { success: true, data: { totalCount: 100, items: [segment] } },
    })
  )
  await page.route("**/api/v1/envs/*/segments/segment-one", (route) =>
    route.fulfill({ json: { success: true, data: segment } })
  )
  const url = "/en/segments?name=Checkout&page=3&pageSize=20"
  await page.goto(url)
  await page.getByRole("link", { name: "Checkout", exact: true }).click()
  await page.getByRole("link", { name: "Settings", exact: true }).click()
  await page.reload()
  await page.getByRole("link", { name: "Segments", exact: true }).last().click()
  await expect(page).toHaveURL(url)
  await expect(page.locator('input[value="Checkout"]')).toBeVisible()
  await page.clock.runFor(1000)
  await expect(page).toHaveURL(url)
})

test("experiments: loaded detail header restores pagination and all filters after refresh", async ({
  page,
}) => {
  const items = Array.from({ length: 120 }, (_, index) => ({
    id: `pagination-experiment-${index + 1}`,
    name: `Pagination experiment ${index + 1}`,
    description: "Pagination navigation fixture",
    stage: "hypothesis",
    flagId: "flag-one",
    flagKey: "checkout",
    flagName: "Checkout",
    runCount: 0,
    stateSummary: { hasLearning: false, runs: [] },
    experimentRuns: [],
    guardrailMetrics: [],
    createdAt: "2026-11-11T10:00:00Z",
    updatedAt: "2026-11-11T10:00:00Z",
  }))
  await page.route("**/api/v1/envs/*/experiments?*", (route) => {
    const params = new URL(route.request().url()).searchParams
    const start =
      Number(params.get("pageIndex")) * Number(params.get("pageSize"))
    return route.fulfill({
      json: {
        success: true,
        data: {
          totalCount: items.length,
          items: items.slice(start, start + Number(params.get("pageSize"))),
        },
      },
    })
  })
  await page.route(
    "**/api/v1/envs/*/experiments/pagination-experiment-41",
    (route) => route.fulfill({ json: { success: true, data: items[40] } })
  )
  await page.route("**/api/v1/envs/*/feature-flags?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          totalCount: 1,
          items: [{ id: "flag-one", key: "checkout", name: "Checkout" }],
        },
      },
    })
  )
  const url =
    "/en/experiments?name=Pagination&page=3&pageSize=20&stage=implementing&flagId=flag-one"
  await page.goto(url)
  await page
    .getByRole("link", { name: "Pagination experiment 41", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Pagination experiment 41", exact: true })
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Pagination experiment 41", exact: true })
  ).toBeVisible()
  await page
    .getByRole("link", { name: "Experiments", exact: true })
    .last()
    .click()
  await expect(page).toHaveURL(url)
  await expect(
    page.getByRole("link", { name: "Pagination experiment 41", exact: true })
  ).toBeVisible()
  await page.clock.runFor(1000)
  await expect(page).toHaveURL(url)
  await expect(page.locator('input[value="Pagination"]')).toBeVisible()
})

test("end users: restores the request cursor and clears it only when search changes", async ({
  page,
}) => {
  const cursor = {
    id: "00000000-0000-0000-0000-000000000001",
    updatedAt: "2026-11-11T10:00:00Z",
    direction: "forward",
  }
  const requests: Record<string, unknown>[] = []
  await page.route("**/api/v1/envs/*/end-users/list", (route) => {
    requests.push(route.request().postDataJSON())
    return route.fulfill({ json: { success: true, data: { items: [] } } })
  })
  await page.route("**/api/v1/envs/*/end-user-properties", (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  )
  const params = new URLSearchParams({
    name: "checkout",
    pageSize: "20",
    cursor: JSON.stringify(cursor),
  })
  await page.goto(`/en/end-users?${params}`)
  await expect.poll(() => requests.length).toBeGreaterThan(0)
  await page.clock.runFor(1000)
  expect(
    requests.every(
      (request) => JSON.stringify(request.cursor) === JSON.stringify(cursor)
    )
  ).toBe(true)
  await page.reload()
  await expect(page.locator('input[value="checkout"]')).toBeVisible()
  await page.locator('input[value="checkout"]').fill("changed")
  await page.clock.runFor(1000)
  await expect.poll(() => requests.at(-1)?.searchText).toBe("changed")
  expect(requests.at(-1)?.cursor).toBeUndefined()
  expect(requests.at(-1)?.pageSize).toBe(20)
  expect(new URL(page.url()).searchParams.has("cursor")).toBe(false)
})

test("flag compare: restores applied environments, filters and page without a mount reset", async ({
  page,
}) => {
  const requests: {
    targetEnvIds: string[]
    filter: Record<string, unknown>
  }[] = []
  await page.route("**/api/v1/envs/*/feature-flags/all-tags", (route) =>
    route.fulfill({ json: { success: true, data: ["release"] } })
  )
  await page.route(
    "**/api/v1/envs/*/feature-flags/compare-overview",
    (route) => {
      requests.push(route.request().postDataJSON())
      return route.fulfill({
        json: { success: true, data: { items: [], totalCount: 100 } },
      })
    }
  )
  const url =
    "/en/feature-flags/compare?name=checkout&tags=release&page=3&pageSize=20&targetEnvIds=env-staging-growth"
  await page.goto(url)
  await expect.poll(() => requests.length).toBeGreaterThan(0)
  await page.clock.runFor(1000)
  await expect(page).toHaveURL(url)
  const beforeRefresh = requests.length
  await page.reload()
  await expect.poll(() => requests.length).toBeGreaterThan(beforeRefresh)
  for (const request of requests) {
    expect(request.targetEnvIds).toEqual(["env-staging-growth"])
    expect(request.filter).toMatchObject({
      name: "checkout",
      tags: ["release"],
      pageIndex: 2,
      pageSize: 20,
    })
  }
})
