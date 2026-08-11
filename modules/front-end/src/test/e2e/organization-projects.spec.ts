import { expect, test } from "@playwright/test"
import {
  createLicense,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test("keeps secret controls inside the Secrets column on a compact desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 720 })
  await setAuthenticatedUser(page)
  await setCurrentContext(page)
  await page.addInitScript(() => {
    localStorage.setItem("featbit:sidebar-collapsed", "true")
  })

  await page.route("**/api/v1/user/workspaces", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "ws-1",
            key: "acme-workspace",
            name: "Acme Workspace",
            license: createLicense("Growth"),
          },
        ],
      },
    })
  })
  await page.route("**/api/v1/organizations**", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "org-1",
            key: "acme-org",
            name: "Acme Corp",
            initialized: true,
          },
        ],
      },
    })
  })
  await page.route("**/api/v1/projects", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "project-commerce",
            name: "Example",
            key: "example",
            environments: [
              {
                id: "env-prod-cn",
                projectId: "project-commerce",
                name: "Dev",
                key: "dev",
                description: "",
                settings: { requireChangeComment: true },
                secrets: [
                  {
                    id: "secret-server",
                    name: "Server Key",
                    type: "server",
                    value: "server-secret-wx9q",
                  },
                  {
                    id: "secret-client",
                    name: "Client Key",
                    type: "client",
                    value: "client-secret-wx9q",
                  },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  await page.goto("/en/organization/projects")

  const environmentRow = page.getByRole("row", { name: /Dev/ })
  await expect(environmentRow).toBeVisible()

  const cells = environmentRow.locator("td")
  const secretsCell = cells.nth(4)
  const actionsCell = cells.nth(5)
  const secretCopyButton = secretsCell
    .getByRole("button", { name: "Copy secret" })
    .first()

  await expect(secretCopyButton).toBeVisible()
  await expect(
    actionsCell.getByRole("button", { name: "Copy environment ID" })
  ).toBeVisible()

  const secretsFit = await secretsCell.evaluate(
    (cell) => cell.scrollWidth <= cell.clientWidth + 1
  )
  expect(secretsFit).toBe(true)

  const secretCopyBox = await secretCopyButton.boundingBox()
  const actionsBox = await actionsCell.boundingBox()

  expect(secretCopyBox).not.toBeNull()
  expect(actionsBox).not.toBeNull()
  expect(secretCopyBox!.x + secretCopyBox!.width).toBeLessThanOrEqual(
    actionsBox!.x + 1
  )
})
