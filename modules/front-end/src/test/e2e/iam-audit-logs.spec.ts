import { expect, test } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test("IAM audit table renders IAM RN and readable changes without an environment filter", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "self-hosted",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)
  await setCurrentContext(page)
  const records = [
    {
      refType: "Group",
      refId: "g1",
      operation: "AddGroupMember",
      previous: { name: "Engineering", rn: "group/Engineering", members: [] },
      current: {
        name: "Engineering",
        rn: "group/Engineering",
        members: [{ id: "u2", name: "Alice", rn: "member/alice@example.com" }],
      },
    },
    {
      refType: "Member",
      refId: "u2",
      operation: "AddMemberPolicy",
      previous: { name: "Alice", rn: "member/alice@example.com", policies: [] },
      current: {
        name: "Alice",
        rn: "member/alice@example.com",
        policies: [{ id: "p1", name: "Developer", rn: "policy/developer" }],
      },
    },
    {
      refType: "Policy",
      refId: "p1",
      operation: "UpdatePolicyStatements",
      previous: {
        name: "Developer",
        rn: "policy/developer",
        statements: [
          {
            id: "s1",
            effect: "allow",
            resourceType: "flag",
            actions: ["ToggleFlag"],
            resources: ["project/*"],
          },
        ],
      },
      current: {
        name: "Developer",
        rn: "policy/developer",
        statements: [
          {
            id: "s1",
            effect: "deny",
            resourceType: "flag",
            actions: ["ToggleFlag"],
            resources: ["project/*"],
          },
        ],
      },
    },
  ].map((item, index) => ({
    ...item,
    id: `log-${index}`,
    workspaceId: "ws-1",
    organizationId: "org-1",
    organizationName: "Platform",
    envId: null,

    creatorId: "admin",
    creatorName: "Admin",
    creatorEmail: "admin@example.com",
    createdAt: "2026-10-12T09:00:00Z",
    comment: "",
    instructions: [],
    dataChange: {
      previous: JSON.stringify(item.previous),
      current: JSON.stringify(item.current),
    },
  }))
  const requests: URL[] = []
  await page.route("**/api/v1/audit-logs?*", (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const items = records.filter(
      (x) =>
        !url.searchParams.get("refType") ||
        x.refType === url.searchParams.get("refType")
    )
    return route.fulfill({
      json: { success: true, data: { items, totalCount: items.length } },
    })
  })
  await page.goto("/en/iam/audit-logs")
  await expect(
    page.getByRole("columnheader", { name: "Resource", exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("group/Engineering", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("member/alice@example.com", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("policy/developer", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Expand audit log" }).first().click()
  await expect(
    page.getByText("Alice member/alice@example.com", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Expand audit log" }).last().click()
  await expect(page.getByText("deny", { exact: true })).toBeVisible()
  await expect(
    page.getByText(
      "Review Team, Groups and Policies changes in the current organization."
    )
  ).toBeVisible()
  expect(requests.length).toBeGreaterThan(0)
  expect(requests.every((url) => !url.searchParams.has("envId"))).toBe(true)
  await expect(
    page.getByRole("columnheader", { name: "Previous", exact: true })
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Expand audit log" }).click()
  await expect(
    page.getByText("Developer policy/developer", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("Added", { exact: true })).toHaveCount(2)
  await expect(page.getByText("Updated", { exact: true })).toBeVisible()
  await page.screenshot({
    path: "test-results/iam-audit-logs.png",
    fullPage: true,
  })
})

test("IAM menu and direct audit route deny users without CanManageIAM", async ({
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
  await page.route("**/api/v1/user/policies", (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  )
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/audit-logs"))
      requests.push(request.url())
  })
  await page.goto("/en/iam/audit-logs")
  await expect(
    page.getByRole("heading", { name: "You don't have access to IAM" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "IAM", exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "Audit Logs", exact: true })
  ).toHaveCount(1)
  expect(requests).toEqual([])
})

test("original Audit Logs keeps environment queries, columns and type options", async ({
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
  const requests: URL[] = []
  await page.route("**/api/v1/envs/*/audit-logs?*", (route) => {
    requests.push(new URL(route.request().url()))
    return route.fulfill({
      json: { success: true, data: { items: [], totalCount: 0 } },
    })
  })
  await page.goto("/en/audit-logs")
  await expect(
    page.getByText("Changes in this environment will appear here.")
  ).toBeVisible()
  expect(requests[0]?.pathname).toBe("/api/v1/envs/env-prod-cn/audit-logs")
  expect(requests[0]?.searchParams.get("crossEnvironment")).toBe("false")
  await expect(
    page.getByRole("columnheader", { name: "Actor", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Resource", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Scope", exact: true })
  ).toHaveCount(0)
  await page.getByRole("combobox").filter({ hasText: "All types" }).click()
  await expect(
    page.getByRole("option", { name: "Feature flag", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("option", { name: "Segment", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("option", { name: "Team", exact: true })
  ).toHaveCount(0)
})

test("switching organization resets IAM filters and uses the new organization context", async ({
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
  const requests: { org: string | undefined; query: string | null }[] = []
  await page.route("**/api/v1/audit-logs?*", (route) => {
    requests.push({
      org: route.request().headers()["organization"],
      query: new URL(route.request().url()).searchParams.get("query"),
    })
    return route.fulfill({
      json: { success: true, data: { items: [], totalCount: 0 } },
    })
  })
  await page.goto("/en/iam/audit-logs")
  await expect(
    page.getByText("IAM changes in this organization will appear here.")
  ).toBeVisible()
  await page
    .getByPlaceholder("Filter by resource or comment")
    .fill("Engineering")
  await expect
    .poll(() =>
      requests.some((x) => x.org === "org-1" && x.query === "Engineering")
    )
    .toBe(true)
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith("current-organization_")
    )!
    localStorage.setItem(
      key,
      JSON.stringify({
        id: "org-2",
        name: "Second",
        key: "second",
        initialized: true,
      })
    )
    window.dispatchEvent(new Event("featbit:organization-changed"))
  })
  await expect(
    page.getByPlaceholder("Filter by resource or comment")
  ).toHaveValue("")
  await expect
    .poll(() => requests.some((x) => x.org === "org-2" && x.query === ""))
    .toBe(true)
  await page.getByRole("combobox").filter({ hasText: "All types" }).click()
  await expect(
    page.getByRole("option", { name: "Team", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("option", { name: "Feature flag", exact: true })
  ).toHaveCount(0)
})

test("original Audit Logs displays shared segment history in its original environment", async ({
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
  const segment = {
    id: "shared-segment",
    workspaceId: "ws-1",
    envId: "env-prod-cn",
    type: "shared",
    name: "Shared customers",
    key: "shared-customers",
    rules: [],
    included: [],
    excluded: [],
    scopes: [],
  }
  const row = {
    id: "shared-created",
    workspaceId: "ws-1",
    organizationId: "org-1",
    envId: segment.envId,
    refType: "Segment",
    refId: segment.id,
    operation: "Create",
    creatorId: "admin",
    creatorName: "Admin",
    creatorEmail: "admin@example.com",
    createdAt: "2026-10-19T10:00:00Z",
    comment: "Shared segment created",
    instructions: [],
    dataChange: { previous: "", current: JSON.stringify(segment) },
  }
  const requests: URL[] = []
  await page.route("**/api/v1/envs/*/audit-logs?*", (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const items = url.pathname.includes(segment.envId) ? [row] : []
    return route.fulfill({
      json: { success: true, data: { items, totalCount: items.length } },
    })
  })
  await page.goto("/en/audit-logs")
  await expect(
    page.getByRole("link", { name: "Shared customers", exact: true })
  ).toHaveAttribute("href", "/en/segments/shared-segment/targeting")
  await expect(
    page.getByText("shared-customers", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("Shared segment created", { exact: true })
  ).toBeVisible()
  expect(requests[0]?.searchParams.get("crossEnvironment")).toBe("false")
  await page.getByRole("combobox").filter({ hasText: "All types" }).click()
  await page.getByRole("option", { name: "Segment", exact: true }).click()
  await expect
    .poll(() =>
      requests.some((url) => url.searchParams.get("refType") === "Segment")
    )
    .toBe(true)
  await expect(
    page.getByRole("link", { name: "Shared customers", exact: true })
  ).toBeVisible()
})
