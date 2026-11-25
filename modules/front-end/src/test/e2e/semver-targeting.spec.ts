import { expect, test } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test("SemVer editing validates values and preserves versions across operators", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mockRuntimeEnv(page, {
    API_URL: "http://localhost:5000",
    HOSTING_MODE: "self-hosted",
    VERSION: "e2e",
  })
  await mockContextEndpoints(page)
  await setAuthenticatedUser(page)
  await setCurrentContext(page)
  const flag = {
    id: "flag-semver",
    envId: "env-prod-cn",
    key: "semver",
    name: "Version targeting",
    tags: [],
    isEnabled: true,
    revision: "1",
    variationType: "boolean",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    variations: [
      { id: "on", name: "Enabled", value: "true" },
      { id: "off", name: "Disabled", value: "false" },
    ],
    disabledVariationId: "off",
    targetUsers: [],
    rules: [
      {
        id: "rule-version",
        name: "Application version",
        conditions: [
          {
            id: "condition-version",
            property: "appVersion",
            op: "SemVerBiggerEqualThan",
            value: "2.3",
          },
        ],
        variations: [{ id: "on", rollout: [0, 1] }],
        dispatchKey: "keyId",
      },
    ],
    fallthrough: {
      variations: [{ id: "off", rollout: [0, 1] }],
      dispatchKey: "keyId",
    },
  }
  const flagsPath = "**/api/v1/envs/env-prod-cn/feature-flags"
  for (const path of [
    `${flagsPath}/all-tags`,
    `${flagsPath}/semver/pending-changes`,
    "**/api/v1/envs/env-prod-cn/end-user-properties",
  ]) {
    await page.route(path, (route) =>
      route.fulfill({ json: { success: true, data: [] } })
    )
  }
  await page.route(`${flagsPath}/semver`, (route) =>
    route.fulfill({ json: { success: true, data: flag } })
  )
  await page.goto("/en/feature-flags/semver/targeting")
  const value = page.getByPlaceholder("Enter a version")
  await expect(value).toHaveValue("2.3")
  await value.fill("")
  await page.getByRole("combobox", { name: "Select operator" }).click()
  await page.getByRole("option", { name: "SemVer >", exact: true }).click()
  await expect(value).toHaveAttribute("aria-invalid", "false")
  await page.screenshot({
    path: testInfo.outputPath("semver-untouched.png"),
    animations: "disabled",
  })
  await page.getByRole("button", { name: "Review & save", exact: true }).click()
  await expect(value).toHaveAttribute("aria-invalid", "true")
  await expect(
    page.getByText("Enter a version.", { exact: true })
  ).toBeVisible()
  await value.fill("4")
  await expect(value).toHaveAttribute("aria-invalid", "false")
  await value.fill("1.2.3.4")
  await value.blur()
  await expect(value).toHaveAttribute("aria-invalid", "true")
  await expect(page.getByText(/Enter a valid version/)).toBeVisible()
  await page.getByRole("button", { name: "Review & save", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("semver-invalid.png") })
  await value.fill("2.3.0-beta.1")
  await page.getByRole("combobox", { name: "Select operator" }).click()
  await page
    .getByRole("option", { name: "SemVer is one of", exact: true })
    .click()
  await expect(page.getByText("2.3.0-beta.1", { exact: true })).toBeVisible()
  await page.getByRole("combobox", { name: "Select values" }).click()
  await page.getByPlaceholder("Search values").fill("3.0.0")
  await page.getByRole("option", { name: 'Add "3.0.0"' }).click()
  await page.getByRole("combobox", { name: "Select operator" }).click()
  await page.getByRole("option", { name: "SemVer >=", exact: true }).click()
  await page.getByRole("button", { name: "3.0.0", exact: true }).click()
  await expect(value).toHaveValue("3.0.0")
  await expect(value).toHaveAttribute("aria-invalid", "false")
  await page.screenshot({ path: testInfo.outputPath("semver-valid.png") })
  await page.getByRole("button", { name: "Review & save", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
})
