import type { Page } from "@playwright/test"

export function createLicense(plan: string, expiresAt = 4102444800000) {
  const payload = btoa(
    JSON.stringify({
      plan,
      sub: "e2e",
      wsId: "ws-1",
      iat: Date.now(),
      exp: expiresAt,
      issuer: "e2e",
      features: ["*"],
    })
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  return `e2e.${payload}.signature`
}

export async function mockAuthEndpoints(
  page: Page,
  options: {
    loginResponse?: unknown
    profileResponse?: unknown
    ssoPreCheck?: unknown
    socialProviders?: unknown
  } = {}
) {
  const {
    loginResponse = { success: false },
    profileResponse = {
      success: true,
      data: {
        id: "test-user-id",
        email: "test@featbit.com",
        name: "Test User",
      },
    },
    ssoPreCheck = { success: true, data: { isEnabled: true } },
    socialProviders = {
      success: true,
      data: [
        {
          name: "Google",
          authorizeUrl: "https://accounts.example.test/google",
        },
        {
          name: "GitHub",
          authorizeUrl: "https://accounts.example.test/github",
        },
        { name: "Okta", authorizeUrl: "https://accounts.example.test/okta" },
      ],
    },
  } = options

  await page.route("**/api/v1/social/providers**", async (route) => {
    await route.fulfill({ json: socialProviders })
  })

  await page.route("**/api/v1/sso/pre-check", async (route) => {
    await route.fulfill({ json: ssoPreCheck })
  })

  await page.route("**/api/v1/identity/login-by-email", async (route) => {
    await route.fulfill({ json: loginResponse })
  })

  await page.route("**/api/v1/user/profile", async (route) => {
    await route.fulfill({ json: profileResponse })
  })
}

export async function mockRuntimeEnv(page: Page, env: Record<string, string>) {
  const entries = Object.entries(env)
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(", ")

  await page.route("**/assets/env.js", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.env = { ${entries} };`,
    })
  })
}

export async function mockCurrentUserPolicies(page: Page) {
  await page.route("**/api/v1/user/policies", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            name: "E2E administrator",
            type: "SysManaged",
            statements: [
              {
                resourceType: "*",
                effect: "allow",
                actions: ["*"],
                resources: ["*"],
              },
            ],
          },
        ],
      },
    })
  })
}

export async function setAuthenticatedUser(
  page: Page,
  user: {
    id?: string
    token?: string
    email?: string
    name?: string
  } = {}
) {
  const {
    id = "test-user-id",
    token = "e2e-token",
    email = "layout@featbit.com",
    name = "Layout User",
  } = user

  await page.addInitScript(
    ({ id, token, email, name }) => {
      localStorage.setItem("token", token)
      localStorage.setItem("auth", JSON.stringify({ id, email, name }))
      localStorage.setItem("featbit:auth-session-id", "e2e-auth-session")
    },
    { id, token, email, name }
  )

  await mockCurrentUserPolicies(page)
}

export async function setCurrentContext(
  page: Page,
  license = createLicense("Growth")
) {
  await page.addInitScript((license) => {
    const userId = "test-user-id"
    localStorage.setItem(
      `current-workspace_${userId}`,
      JSON.stringify({
        id: "ws-1",
        key: "acme-workspace",
        name: "Acme Workspace",
        license,
      })
    )
    localStorage.setItem(
      `current-organization_${userId}`,
      JSON.stringify({
        id: "org-1",
        key: "acme-org",
        name: "Acme Corp",
        initialized: true,
      })
    )
    localStorage.setItem(
      `current-project_${userId}`,
      JSON.stringify({
        projectId: "project-commerce",
        projectName: "Commerce Apps",
        projectKey: "commerce",
        envId: "env-prod-cn",
        envKey: "prod-cn",
        envName: "Production CN",
      })
    )
  }, license)
}

export async function mockContextEndpoints(page: Page) {
  await mockCurrentUserPolicies(page)
  await mockContextEndpointResponses(page)
}

export async function mockContextEndpointsWithExpiredAccessToken(page: Page) {
  let firstWorkspaceRequest = true

  await page.route("**/api/v1/user/workspaces", async (route) => {
    if (firstWorkspaceRequest) {
      firstWorkspaceRequest = false
      await route.fulfill({
        status: 401,
        json: { success: false, errors: ["Unauthorized"] },
      })
      return
    }

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

  await page.route("**/api/v1/identity/refresh-token", async (route) => {
    await route.fulfill({
      json: { success: true, data: { token: "refreshed-token" } },
    })
  })

  await mockOrganizationAndProjectResponses(page)
}

async function mockContextEndpointResponses(page: Page) {
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

  await mockOrganizationAndProjectResponses(page)
}

async function mockOrganizationAndProjectResponses(page: Page) {
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
            id: "project-growth",
            name: "Growth Platform",
            key: "growth",
            environments: [
              {
                id: "env-prod-growth",
                projectId: "project-growth",
                name: "Production",
                key: "prod",
              },
              {
                id: "env-staging-growth",
                projectId: "project-growth",
                name: "Staging",
                key: "staging",
              },
              {
                id: "env-dev-growth",
                projectId: "project-growth",
                name: "Development",
                key: "dev",
              },
            ],
          },
          {
            id: "project-commerce",
            name: "Commerce Apps",
            key: "commerce",
            environments: [
              {
                id: "env-prod-cn",
                projectId: "project-commerce",
                name: "Production CN",
                key: "prod-cn",
              },
              {
                id: "env-dev-commerce",
                projectId: "project-commerce",
                name: "Development",
                key: "dev",
              },
            ],
          },
        ],
      },
    })
  })
}
