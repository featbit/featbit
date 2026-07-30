import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { App } from "@/app/app"

describe("App shell", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    window.history.pushState({}, "", "/")
  })

  function mockLayoutContextApi() {
    let workspaceRequestCount = 0

    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)

      if (url.endsWith("/api/v1/user/workspaces")) {
        workspaceRequestCount += 1
        if (workspaceRequestCount === 1) {
          return new Response(JSON.stringify({ success: false }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: [{ id: "ws-real", key: "real", name: "Real Workspace" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/organizations")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [{ id: "org-real", key: "real-org", name: "Real Org" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.endsWith("/api/v1/projects")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "project-real",
                key: "platform",
                name: "Real Platform",
                environments: [
                  {
                    id: "env-real",
                    projectId: "project-real",
                    key: "prod",
                    name: "Real Production",
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.endsWith("/api/v1/identity/refresh-token")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { token: "refreshed-token" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
  }

  function mockWorkspaceSelectionApi() {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)

      if (url.endsWith("/api/v1/user/workspaces")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              { id: "ws-one", key: "one", name: "Workspace One" },
              { id: "ws-two", key: "two", name: "Workspace Two" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
  }

  function mockOnboardingApi() {
    let onboardingCompleted = false

    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)

      if (url.endsWith("/api/v1/user/workspaces")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [{ id: "ws-real", key: "real", name: "Real Workspace" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.endsWith("/api/v1/organizations/onboarding")) {
        onboardingCompleted = true
        return new Response(JSON.stringify({ success: true, data: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url.includes("/api/v1/organizations")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "org-new",
                key: "new-org",
                name: "New Org",
                initialized: onboardingCompleted,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.endsWith("/api/v1/projects")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "project-created",
                key: "example-project",
                name: "Example project",
                environments: [
                  { id: "env-dev", key: "dev", name: "Dev" },
                  { id: "env-prod", key: "prod", name: "Prod" },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
  }

  function signIn() {
    localStorage.setItem("token", "test-token")
    localStorage.setItem(
      "auth",
      JSON.stringify({
        id: "user-1",
        name: "Test User",
        email: "test@featbit.com",
      })
    )
  }

  function mockAuthOptionsApi(ssoEnabled = true) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)

      if (url.endsWith("/api/v1/sso/pre-check")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { isEnabled: ssoEnabled, workspaceKey: "" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
  }

  function mockNoAccessibleEnvironmentsApi() {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)

      if (url.endsWith("/api/v1/user/workspaces")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [{ id: "ws-real", key: "real", name: "Real Workspace" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/organizations")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "org-real",
                key: "real-org",
                name: "Real Org",
                initialized: true,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
  }

  it("redirects to the localized login route", async () => {
    render(<App />)

    expect(
      await screen.findByText("Sign in to your workspace")
    ).toBeInTheDocument()
  })

  it("renders the localized SSO route", async () => {
    window.history.pushState({}, "", "/en/login/sso")
    mockAuthOptionsApi()

    render(<App />)

    expect(await screen.findByText("Sign in with SSO")).toBeInTheDocument()
  })

  it("reads runtime env version with a dev fallback", async () => {
    window.history.pushState({}, "", "/en")
    signIn()
    mockLayoutContextApi()

    render(<App />)

    expect(await screen.findByText("Real Org")).toBeInTheDocument()
    expect(
      await screen.findByText(
        "Authenticated layout ready. Page content will migrate in later steps."
      )
    ).toBeInTheDocument()
  })

  it("redirects unauthenticated app routes to login", async () => {
    window.history.pushState({}, "", "/en")

    render(<App />)

    expect(
      await screen.findByText("Sign in to your workspace")
    ).toBeInTheDocument()
  })

  it("signs out and explains when no environment is accessible", async () => {
    mockNoAccessibleEnvironmentsApi()
    window.history.pushState({}, "", "/en/feature-flags")
    signIn()
    localStorage.setItem(
      "current-project_user-1",
      JSON.stringify({
        projectId: "project-stale",
        projectKey: "stale",
        projectName: "Stale project",
        envId: "env-stale",
        envKey: "stale",
        envName: "Stale environment",
      })
    )

    render(<App />)

    expect(await screen.findByText("Permission Denied")).toBeInTheDocument()
    expect(
      screen.getByText(
        "You don't have permission to access any projects or environments. Contact an administrator to request access."
      )
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/login")
    expect(window.location.search).toBe("?reason=permission-denied")
    expect(localStorage.getItem("token")).toBeNull()
    expect(localStorage.getItem("auth")).toBeNull()
  })

  it("signs out only the current tab for an inaccessible URL environment", async () => {
    mockLayoutContextApi()
    window.history.pushState(
      {},
      "",
      "/en/feature-flags?context=environment&projectId=project-real&envId=env-inaccessible"
    )
    signIn()

    render(<App />)

    expect(await screen.findByText("Permission Denied")).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/login")
    expect(window.location.search).toBe("?reason=permission-denied")
    expect(localStorage.getItem("token")).toBe("refreshed-token")
    expect(localStorage.getItem("auth")).toContain("user-1")
    expect(sessionStorage.getItem("featbit:tab-signed-out")).toBe("true")
  })

  it("uses the authenticated route language for layout copy", async () => {
    window.history.pushState({}, "", "/zh")
    signIn()
    mockLayoutContextApi()

    render(<App />)

    expect(
      await screen.findByText("认证布局已就绪，页面内容将在后续步骤迁移。")
    ).toBeInTheDocument()
  })

  it("loads real context data for the authenticated context bar", async () => {
    const fetchMock = mockLayoutContextApi()
    window.history.pushState({}, "", "/en")
    signIn()

    render(<App />)

    expect(await screen.findByText("Real Org")).toBeInTheDocument()
    expect(await screen.findByText("Real Platform")).toBeInTheDocument()
    expect(await screen.findByText("Real Production")).toBeInTheDocument()
    expect(localStorage.getItem("current-workspace_user-1")).toContain(
      "Real Workspace"
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/user/workspaces"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/identity/refresh-token"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/user/workspaces"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer refreshed-token",
        }),
      })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/projects"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer refreshed-token",
          Organization: "org-real",
          Workspace: "ws-real",
        }),
      })
    )
  })

  it("redirects authenticated users without selected workspace to workspace selection", async () => {
    mockWorkspaceSelectionApi()
    window.history.pushState({}, "", "/en")
    signIn()

    render(<App />)

    expect(await screen.findByText("Select a workspace")).toBeInTheDocument()
    expect(await screen.findByText("Workspace One")).toBeInTheDocument()
    expect(await screen.findByText("Workspace Two")).toBeInTheDocument()
  })

  it("returns to login when both the access and refresh tokens have expired", async () => {
    window.history.pushState({}, "", "/en/webhooks")
    signIn()
    localStorage.setItem("login-redirect-url", "/en/webhooks")

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "Content-Type": "application/json" },
      })
    )

    render(<App />)

    expect(
      await screen.findByText("Sign in to your workspace")
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/login")
    expect(localStorage.getItem("login-redirect-url")).toBe("/en/webhooks")
    expect(localStorage.getItem("token")).toBeNull()
  })

  it("redirects uninitialized organizations to onboarding", async () => {
    mockOnboardingApi()
    window.history.pushState({}, "", "/en")
    signIn()

    render(<App />)

    expect(
      await screen.findByText("Set up your first organization")
    ).toBeInTheDocument()
  })

  it("completes onboarding and persists the initialized organization", async () => {
    const fetchMock = mockOnboardingApi()
    window.history.pushState({}, "", "/en/onboarding")
    signIn()
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({ id: "ws-real", key: "real", name: "Real Workspace" })
    )
    localStorage.setItem(
      "current-organization_user-1",
      JSON.stringify({
        id: "org-new",
        key: "new-org",
        name: "New Org",
        initialized: false,
      })
    )

    render(<App />)

    fireEvent.click(await screen.findByText("Complete setup"))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/organizations/onboarding"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            organizationName: "New Org",
            organizationKey: "new-org",
            projectName: "Example project",
            projectKey: "example-project",
            environments: ["Dev", "Prod"],
          }),
        })
      )
    })
    expect(localStorage.getItem("current-organization_user-1")).toContain(
      '"initialized":true'
    )
    expect(localStorage.getItem("current-project_user-1")).toContain(
      '"projectName":"Example project"'
    )
    expect(localStorage.getItem("current-project_user-1")).toContain(
      '"envName":"Dev"'
    )
    expect(
      await screen.findByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText("New Org")).toBeInTheDocument()
      expect(screen.getByText("Example project")).toBeInTheDocument()
      expect(screen.getByText("Dev")).toBeInTheDocument()
    })
  })
})
