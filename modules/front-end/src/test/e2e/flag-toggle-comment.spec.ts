import { expect, test } from "@playwright/test"
import {
  mockContextEndpoints,
  mockRuntimeEnv,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

for (const surface of ["list", "details"] as const) {
  for (const requireChangeComment of [false, true]) {
    test(`${surface} toggle supports ${requireChangeComment ? "required" : "optional"} change comments`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({
        width: surface === "list" ? 1440 : 1280,
        height: 900,
      })
      await mockRuntimeEnv(page, {
        API_URL: "http://localhost:5000",
        HOSTING_MODE: "self-hosted",
        VERSION: "e2e",
      })
      await mockContextEndpoints(page)
      for (const resource of ["policies", "groups"]) {
        await page.route(`**/api/v1/${resource}?*`, (route) =>
          route.fulfill({
            json: { success: true, data: { items: [], totalCount: 0 } },
          })
        )
      }
      await page.route("**/api/v1/organizations/default-permissions", (route) =>
        route.fulfill({
          json: { success: true, data: { policies: [], groups: [] } },
        })
      )
      await setAuthenticatedUser(page)
      await setCurrentContext(page)
      let currentRequireChangeComment = requireChangeComment
      let documentRequests = 0
      page.on("request", (request) => {
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        ) {
          documentRequests += 1
        }
      })
      await page.route("**/api/v1/projects", (route) =>
        route.fulfill({
          json: {
            success: true,
            data: [
              {
                id: "project-commerce",
                name: "Commerce Apps",
                key: "commerce",
                environments: [
                  {
                    id: "env-dev-commerce",
                    projectId: "project-commerce",
                    name: "Development",
                    key: "dev",
                    settings: { requireChangeComment: !requireChangeComment },
                  },
                  {
                    id: "env-prod-cn",
                    projectId: "project-commerce",
                    name: "Production CN",
                    key: "prod-cn",
                    settings: {
                      requireChangeComment: currentRequireChangeComment,
                    },
                  },
                ],
              },
            ],
          },
        })
      )
      await page.route(
        "**/api/v1/projects/project-commerce/envs/env-prod-cn",
        (route) => {
          const payload = route.request().postDataJSON()
          currentRequireChangeComment = payload.settings.requireChangeComment
          return route.fulfill({
            json: {
              success: true,
              data: {
                ...payload,
                id: "env-prod-cn",
                projectId: "project-commerce",
                key: "prod-cn",
                secrets: [],
              },
            },
          })
        }
      )

      const flag = {
        id: "flag-1",
        envId: "env-prod-cn",
        key: "checkout-redesign",
        name: "Checkout redesign",
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
        rules: [],
        fallthrough: { variations: [{ id: "on", rollout: [0, 1] }] },
      }
      const flagsPath = "**/api/v1/envs/env-prod-cn/feature-flags"
      for (const path of [
        `${flagsPath}/all-tags`,
        `${flagsPath}/${flag.key}/pending-changes`,
        "**/api/v1/envs/env-prod-cn/end-user-properties",
      ]) {
        await page.route(path, (route) =>
          route.fulfill({ json: { success: true, data: [] } })
        )
      }
      await page.route(`${flagsPath}?*`, (route) =>
        route.fulfill({
          json: { success: true, data: { totalCount: 1, items: [flag] } },
        })
      )
      await page.route(`${flagsPath}/${flag.key}`, (route) =>
        route.fulfill({ json: { success: true, data: flag } })
      )
      await page.route(`${flagsPath}/${flag.key}/toggle/*`, (route) => {
        flag.isEnabled = route.request().url().endsWith("/true")
        return route.fulfill({ json: { success: true, data: "2" } })
      })

      await page.goto(
        surface === "list"
          ? "/en/feature-flags"
          : `/en/feature-flags/${flag.key}/targeting`
      )
      const toggle = page.getByRole("switch").first()
      await expect(toggle).toBeChecked({ timeout: 15_000 })
      await toggle.click()
      const dialog = page.getByRole("dialog", {
        name: "Turn feature flag off?",
      })
      const comment = dialog.getByRole("textbox", { name: /Change comment/ })
      const confirm = dialog.getByRole("button", {
        name: "Confirm",
        exact: true,
      })
      await expect(comment).toBeVisible()
      const key = dialog.getByPlaceholder("Feature flag key")
      await expect(key).toBeVisible()
      await expect(confirm).toBeDisabled()
      await key.fill("wrong-flag-key")
      await expect(confirm).toBeDisabled()
      await key.fill(flag.key)
      if (requireChangeComment) {
        await expect(confirm).toBeDisabled()
        await comment.fill("   ")
        await expect(confirm).toBeDisabled()
      } else {
        await expect(
          dialog.getByText("(optional)", { exact: true })
        ).toBeVisible()
        await expect(confirm).toBeEnabled()
      }
      await comment.fill("  Roll back checkout after review  ")
      await expect(confirm).toBeEnabled()
      await page.screenshot({ path: testInfo.outputPath("toggle-comment.png") })
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/${flag.key}/toggle/false`) &&
          response.request().method() === "PUT" &&
          response.ok()
      )
      await confirm.click()
      expect((await response).request().postDataJSON()).toEqual({
        comment: "Roll back checkout after review",
      })
      await expect(dialog).not.toBeVisible()
      await expect(toggle).not.toBeChecked()

      await toggle.click()
      const nextDialog = page.getByRole("dialog", {
        name: "Turn feature flag on?",
      })
      await expect(
        nextDialog.getByRole("textbox", { name: /Change comment/ })
      ).toHaveValue("")
      const nextKey = nextDialog.getByPlaceholder("Feature flag key")
      await expect(nextKey).toHaveValue("")
      await expect(
        nextDialog.getByRole("button", { name: "Confirm", exact: true })
      ).toBeDisabled()
      await nextKey.fill(flag.key)
      if (!requireChangeComment) {
        const response = page.waitForResponse(
          (response) =>
            response.url().endsWith(`/${flag.key}/toggle/true`) &&
            response.request().method() === "PUT" &&
            response.ok()
        )
        await nextDialog
          .getByRole("button", { name: "Confirm", exact: true })
          .click()
        expect((await response).request().postDataJSON()).toEqual({
          comment: "",
        })
        await expect(toggle).toBeChecked()
      } else {
        await expect(
          nextDialog.getByRole("button", { name: "Confirm", exact: true })
        ).toBeDisabled()
        await nextDialog
          .getByRole("button", { name: "Cancel", exact: true })
          .click()
      }

      // Navigate within the SPA so the already-populated settings cache survives.
      await page
        .getByRole("link", { name: "Organization", exact: true })
        .click()
      await page.getByRole("tab", { name: "Projects", exact: true }).click()
      await page
        .getByRole("row", { name: /Production CN/ })
        .getByRole("button", { name: "Edit environment", exact: true })
        .click()
      const environmentSheet = page.getByRole("dialog", {
        name: "Edit environment",
      })
      await environmentSheet
        .getByRole("checkbox", { name: /Require change comment/ })
        .setChecked(!requireChangeComment)
      const settingsResponse = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith("/projects/project-commerce/envs/env-prod-cn") &&
          response.request().method() === "PUT" &&
          response.ok()
      )
      await environmentSheet
        .getByRole("button", { name: "Save environment", exact: true })
        .click()
      expect(
        (await settingsResponse).request().postDataJSON().settings
      ).toEqual({
        requireChangeComment: !requireChangeComment,
      })
      await expect(environmentSheet).not.toBeVisible()
      await page
        .getByRole("link", { name: "Feature Flags", exact: true })
        .click()
      if (surface === "details") {
        await page.getByRole("link", { name: flag.name, exact: true }).click()
      }
      await toggle.click()
      const updatedDialog = page.getByRole("dialog", {
        name: /Turn feature flag (on|off)\?/,
      })
      const updatedComment = updatedDialog.getByRole("textbox", {
        name: /Change comment/,
      })
      await expect(updatedComment).toHaveJSProperty(
        "required",
        !requireChangeComment
      )
      await updatedDialog.getByPlaceholder("Feature flag key").fill(flag.key)
      const updatedConfirm = updatedDialog.getByRole("button", {
        name: "Confirm",
        exact: true,
      })
      if (requireChangeComment) {
        await expect(updatedConfirm).toBeEnabled()
      } else {
        await expect(updatedConfirm).toBeDisabled()
        await updatedComment.fill("Approved after environment settings update")
        await expect(updatedConfirm).toBeEnabled()
      }
      expect(documentRequests).toBe(1)
    })
  }
}
