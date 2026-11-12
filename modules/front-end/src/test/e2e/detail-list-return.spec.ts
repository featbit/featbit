import { expect, test } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

const cases = [
  {
    list: "feature-flags",
    api: "envs/*/feature-flags",
    detail: "navigation-item/targeting",
    tab: "History",
    tabRole: "link",
    remove: "Remove permanently",
  },
  {
    list: "segments",
    api: "envs/*/segments",
    detail: "navigation-item/targeting",
    tab: "History",
    tabRole: "link",
    remove: "Remove permanently",
  },
  {
    list: "iam/team",
    api: "members",
    detail: "navigation-item/permissions",
    tab: "Groups",
    tabRole: "tab",
    remove: "Remove member",
  },
  {
    list: "iam/groups",
    api: "groups",
    detail: "navigation-item/team",
    tab: "Policies",
    tabRole: "tab",
    remove: "Remove group",
  },
  {
    list: "iam/policies",
    api: "policies",
    detail: "navigation-item/permission",
    tab: "Groups",
    tabRole: "tab",
    remove: "Remove policy",
  },
] as const

test.beforeEach(async ({ page }) => {
  // Never send fixture requests (especially deletes) to the local database.
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      status: 404,
      json: { success: false, errors: ["Unmocked fixture endpoint"] },
    })
  )
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "self-hosted",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await page.route("**/api/v1/envs/*/end-user-properties", (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  )
  await setAuthenticatedUser(page)
  await setCurrentContext(page)
})

for (const entry of cases) {
  test(`${entry.list}: loaded return, tabs, refresh and delete preserve list state`, async ({
    page,
  }) => {
    const archived = entry.list === "feature-flags" || entry.list === "segments"
    const record = {
      id: "navigation-item",
      key: "navigation-item",
      name: "Pagination navigation item",
      description: "Navigation fixture",
      email: "pagination@example.invalid",
      type:
        entry.list === "segments" ? "environment-specific" : "CustomerManaged",
      envId: "env-prod-growth",
      workspaceId: "ws-1",
      organizationId: "org-1",
      groups: [],
      statements: [],
      scopes: [],
      included: [],
      excluded: [],
      rules: [],
      tags: [],
      isArchived: archived,
      isEnabled: false,
      variationType: "boolean",
      variations: [
        { id: "on", name: "On", value: "true" },
        { id: "off", name: "Off", value: "false" },
      ],
      disabledVariationId: "off",
      targetUsers: [],
      fallthrough: { variations: [{ id: "on", rollout: [0, 1] }] },
      creatorId: "test-user-id",
      updatorId: "test-user-id",
      createdAt: "2026-11-11T10:00:00Z",
      updatedAt: "2026-11-11T10:00:00Z",
    }
    let deletes = 0
    let failDetail = false
    await page.route(`**/api/v1/${entry.api}?*`, (route) =>
      route.fulfill({
        json: { success: true, data: { items: [record], totalCount: 100 } },
      })
    )
    await page.route(`**/api/v1/${entry.api}/navigation-item/**`, (route) =>
      route.fulfill({
        json: {
          success: true,
          data: /\/(permissions|pending-changes)$/.test(route.request().url())
            ? []
            : { items: [], totalCount: 0 },
        },
      })
    )
    await page.route(`**/api/v1/${entry.api}/navigation-item`, (route) => {
      if (route.request().method() === "DELETE") {
        deletes++
        return route.fulfill({ json: { success: true, data: true } })
      }
      return route.fulfill(
        failDetail
          ? { status: 404, json: { success: false, errors: ["Not found"] } }
          : { json: { success: true, data: record } }
      )
    })
    await page.route(
      "**/api/v1/members/remove-from-org/navigation-item",
      (route) => {
        expect(route.request().method()).toBe("DELETE")
        deletes++
        return route.fulfill({ json: { success: true, data: true } })
      }
    )
    const source = `/en/${entry.list}?name=Pagination&page=3&pageSize=20${archived ? "&archived=true" : ""}`
    await page.goto(source)
    await page.getByRole("link", { name: record.name, exact: true }).click()
    await expect(
      page.getByRole("heading", { name: record.name, exact: true })
    ).toBeVisible()
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(source)
    await page
      .getByRole(entry.tabRole, { name: new RegExp(`^${entry.tab}`) })
      .click()
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(source)
    await page.reload()
    await expect(
      page.getByRole("heading", { name: record.name, exact: true })
    ).toBeVisible()
    await page.locator(`a[href="${source}"]`).click()
    await expect(page).toHaveURL(source)
    await expect(page.locator('input[value="Pagination"]')).toBeVisible()

    await page.getByRole("link", { name: record.name, exact: true }).click()
    if (archived)
      await page.getByRole("link", { name: "Settings", exact: true }).click()
    await page.reload()
    await page.getByRole("button", { name: entry.remove, exact: true }).click()
    await page
      .locator('[role="dialog"], [role="alertdialog"]')
      .getByRole("button", { name: "Remove", exact: true })
      .click()
    await expect(page).toHaveURL(source)
    expect(deletes).toBe(1)

    if (entry.list === "feature-flags") {
      const compareSource =
        "/en/feature-flags/compare?name=Pagination&page=3&pageSize=20&tags=release&targetEnvIds=env-prod-growth&context=environment&projectId=project-commerce&envId=env-prod-cn"
      await page.goto(
        `/en/feature-flags/${entry.detail}?${new URLSearchParams({ returnTo: compareSource })}`
      )
      await page.getByRole("link", { name: "History", exact: true }).click()
      await page.reload()
      await page.locator(`a[href="${compareSource}"]`).click()
      await expect(page).toHaveURL(compareSource)
      await page.goto(
        `/en/feature-flags/navigation-item/settings?${new URLSearchParams({ returnTo: compareSource })}`
      )
      await page
        .getByRole("button", { name: entry.remove, exact: true })
        .click()
      await page
        .locator('[role="dialog"], [role="alertdialog"]')
        .getByRole("button", { name: "Remove", exact: true })
        .click()
      await expect(page).toHaveURL(compareSource)
      expect(deletes).toBe(2)
    }

    // The fallback return must also survive a missing/deleted detail resource.
    failDetail = true
    await page.goto(
      `/en/${entry.list}/${entry.detail}?${new URLSearchParams({ returnTo: source })}`
    )
    if (archived) {
      await page.getByRole("button", { name: /back to/i }).click()
    } else {
      await page.locator(`a[href="${source}"]`).click()
    }
    await expect(page).toHaveURL(source)
  })
}
