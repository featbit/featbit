import { expect, test } from "@playwright/test"
import {
  createLicense,
  mockContextEndpoints,
  setAuthenticatedUser,
  setCurrentContext,
} from "./helpers"

test.describe("workspace general", () => {
  test("renders workspace settings and updates identity", async ({ page }) => {
    await mockContextEndpoints(page)
    await setAuthenticatedUser(page)
    await setCurrentContext(page)

    await page.route("**/api/v1/workspaces", async (route) => {
      if (route.request().method() === "PUT") {
        const payload = route.request().postDataJSON() as {
          id: string
          name: string
          key: string
        }

        await route.fulfill({
          json: {
            success: true,
            data: {
              ...payload,
              license: createLicense("Growth"),
              sso: {
                oidc: {
                  clientId: "featbit-client",
                  clientSecret: "secret",
                  tokenEndpoint: "https://idp.example.test/token",
                  clientAuthenticationMethod: "Client secret basic",
                  authorizationEndpoint: "https://idp.example.test/authorize",
                  scope: "openid email profile",
                  userEmailClaim: "email",
                },
              },
            },
          },
        })
        return
      }

      await route.fulfill({
        json: {
          success: true,
          data: {
            id: "ws-1",
            key: "acme-workspace",
            name: "Acme Workspace",
            license: createLicense("Growth"),
            sso: {
              oidc: {
                clientId: "featbit-client",
                clientSecret: "secret",
                tokenEndpoint: "https://idp.example.test/token",
                clientAuthenticationMethod: "Client secret basic",
                authorizationEndpoint: "https://idp.example.test/authorize",
                scope: "openid email profile",
                userEmailClaim: "email",
              },
            },
          },
        },
      })
    })

    await page.goto("/en/workspace")

    await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "General" })).toBeVisible()
    await expect(page.getByLabel("Name")).toHaveValue("Acme Workspace")
    await expect(page.getByLabel("Key")).toHaveValue("acme-workspace")
    await expect(page.getByLabel("Client ID")).toHaveValue("featbit-client")

    await page.getByLabel("Name").fill("Acme Workspace Updated")
    await page.getByRole("button", { name: "Save changes" }).click()

    await expect(page.getByText("Operation succeeded")).toBeVisible()
    await expect(
      page.evaluate(() =>
        localStorage.getItem("current-workspace_test-user-id")
      )
    ).resolves.toContain("Acme Workspace Updated")
  })
})
