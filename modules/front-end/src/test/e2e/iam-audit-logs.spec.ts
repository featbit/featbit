import { expect, test } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test("workspace audit table renders IAM RN and readable changes without an environment filter", async ({
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
    organizationId: "org-2",
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
  await page.goto("/en/audit-logs")
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
    page.getByText("Review changes across this workspace.")
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
