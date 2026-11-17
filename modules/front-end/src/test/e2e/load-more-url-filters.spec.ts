import { expect, test } from "@playwright/test"
import {
  createLicense,
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 404, json: { success: false } })
  )
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
          name: "Workspace",
          license: createLicense("Growth"),
        },
      },
    })
  )
})

for (const list of ["audit-logs", "iam/audit-logs", "change-requests"]) {
  test(`${list}: refresh, load more and clear preserve URL filters`, async ({
    page,
  }) => {
    const cr = list === "change-requests"
    const iam = list === "iam/audit-logs"
    const requests: URLSearchParams[] = []
    const flag = {
      id: "flag-1",
      key: "checkout",
      name: "Checkout flag",
      variationType: "boolean",
      isEnabled: false,
      isArchived: false,
      tags: [],
      rules: [],
      targetUsers: [],
      variations: [
        { id: "on", value: "true", name: "On" },
        { id: "off", value: "false", name: "Off" },
      ],
      disabledVariationId: "off",
      fallthrough: { variations: [{ id: "on", rollout: [0, 1] }] },
    }
    const snapshot = iam
      ? {
          id: "group-1",
          name: "Checkout group",
          rn: "group/checkout",
          description: "Before",
          members: [],
          policies: [],
        }
      : flag
    const dataChange = {
      previous: JSON.stringify(snapshot),
      current: JSON.stringify({ ...snapshot, description: "After" }),
    }
    const records = Array.from({ length: 25 }, (_, i) =>
      cr
        ? {
            id: `request-${i}`,
            reason: `Checkout request ${i}`,
            flagId: flag.id,
            flagName: flag.name,
            flagKey: flag.key,
            scopeRn: "project/test:env/dev",
            status: "PendingReview",
            creatorId: "user-1",
            creatorName: "Tester",
            updatorId: "user-1",
            updatorName: "Tester",
            createdAt: "2026-11-11T10:00:00Z",
            updatedAt: "2026-11-11T10:00:00Z",
            reviewers: [],
            instructions: [],
            dataChange,
            canReview: false,
            canApply: false,
          }
        : {
            id: `audit-${i}`,
            refId: snapshot.id,
            refType: iam ? "Group" : "FeatureFlag",
            operation: iam ? "UpdateGroup" : "Update",
            creatorId: "user-1",
            creatorName: "Tester",
            createdAt: "2026-11-11T10:00:00Z",
            comment: `Checkout audit ${i}`,
            dataChange,
            instructions: [],
          }
    )
    await page.route(
      cr ? "**/api/v1/envs/*/change-requests?*" : "**/api/v1/audit-logs?*",
      (route) => {
        const params = new URL(route.request().url()).searchParams
        requests.push(params)
        const start =
          Number(params.get("pageIndex")) * Number(params.get("pageSize"))
        return route.fulfill({
          json: {
            success: true,
            data: {
              items: records.slice(
                start,
                start + Number(params.get("pageSize"))
              ),
              totalCount: 25,
              needsReviewCount: 0,
            },
          },
        })
      }
    )
    const source = `/en/${list}?query=checkout&creatorId=user-1&creatorName=Tester&${cr ? "reviewerId=user-2&reviewerName=Reviewer&status=PendingReview" : `refType=${iam ? "Group" : "FeatureFlag"}&from=2026-11-01&to=2026-11-12`}`
    await page.goto(source)
    const rows = page
      .getByRole("row")
      .filter({ hasText: cr ? /Checkout request \d/ : /Checkout audit \d/ })
    await expect(rows).toHaveCount(cr ? 20 : 10)
    await expect(
      page.getByRole("textbox", {
        name: cr
          ? "Filter by comment"
          : iam
            ? "Filter by resource or comment"
            : "Filter by key or comment",
      })
    ).toHaveValue("checkout")
    await expect(
      page.getByRole("combobox").filter({ hasText: "Tester" })
    ).toBeVisible()
    while (
      await page.getByRole("button", { name: "Load more", exact: true }).count()
    ) {
      const before = await rows.count()
      await page.getByRole("button", { name: "Load more", exact: true }).click()
      await expect(rows).toHaveCount(Math.min(25, before + (cr ? 20 : 10)))
    }
    await expect(page).toHaveURL(source)
    expect(new Set(await rows.allTextContents()).size).toBe(25)
    await page.reload()
    await expect(rows).toHaveCount(cr ? 20 : 10)
    await expect(page).toHaveURL(source)
    for (const params of requests) {
      expect(params.get("query")).toBe("checkout")
      expect(params.get("creatorId")).toBe("user-1")
      if (cr) {
        expect(params.get("reviewerId")).toBe("user-2")
        expect(params.get("status")).toBe("PendingReview")
      } else {
        expect(params.getAll("refTypes")).toEqual([
          iam ? "Group" : "FeatureFlag",
        ])
        expect(Number(params.get("from"))).toBe(new Date(2026, 10, 1).getTime())
        expect(Number(params.get("to"))).toBe(new Date(2026, 10, 13).getTime())
      }
    }
    if (!iam) {
      if (cr)
        await page
          .getByRole("button", { name: "Expand change request", exact: true })
          .first()
          .click()
      const link = cr
        ? page
            .getByRole("link", { name: "View in targeting", exact: true })
            .first()
        : page.getByRole("link", { name: "Checkout flag", exact: true }).first()
      const href = await link.getAttribute("href")
      expect(
        new URL(href!, "http://localhost").searchParams.get("returnTo")
      ).toBeNull()
      if (cr) await expect(link).toHaveAttribute("target", "_blank")
    }
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click()
    await expect(page).toHaveURL(`/en/${list}`)
    await expect.poll(() => requests.at(-1)?.get("query") ?? "").toBe("")
    // Selecting another filter before the search debounce fires must retain the draft.
    await page
      .getByRole("textbox", {
        name: cr
          ? "Filter by comment"
          : iam
            ? "Filter by resource or comment"
            : "Filter by key or comment",
      })
      .fill("updated")
    await (
      cr
        ? page.getByRole("combobox", { name: "Status", exact: true })
        : page.getByRole("combobox").filter({ hasText: "All types" })
    ).click()
    await page
      .getByRole("option", {
        name: cr ? "Approved" : iam ? "Policy" : "Segment",
        exact: true,
      })
      .click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get("query"))
      .toBe("updated")
    expect(
      new URL(page.url()).searchParams.get(cr ? "status" : "refType")
    ).toBe(cr ? "Approved" : iam ? "Policy" : "Segment")
    await page.reload()
    await expect(
      page.getByRole("textbox", {
        name: cr
          ? "Filter by comment"
          : iam
            ? "Filter by resource or comment"
            : "Filter by key or comment",
      })
    ).toHaveValue("updated")
  })
}
