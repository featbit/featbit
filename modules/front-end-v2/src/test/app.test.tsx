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

  it("redirects to the localized login route", async () => {
    render(<App />)

    expect(
      await screen.findByText("Sign in to your workspace")
    ).toBeInTheDocument()
  })

  it("renders the localized SSO route", async () => {
    window.history.pushState({}, "", "/en/login/sso")

    render(<App />)

    expect(await screen.findByText("Sign in with SSO")).toBeInTheDocument()
  })

  it("reads runtime env version with a dev fallback", async () => {
    window.history.pushState({}, "", "/en/app")
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
    window.history.pushState({}, "", "/en/app")

    render(<App />)

    expect(
      await screen.findByText("Sign in to your workspace")
    ).toBeInTheDocument()
  })

  it("uses the authenticated route language for layout copy", async () => {
    window.history.pushState({}, "", "/zh/app")
    signIn()
    mockLayoutContextApi()

    render(<App />)

    expect(
      await screen.findByText("认证布局已就绪，页面内容将在后续步骤迁移。")
    ).toBeInTheDocument()
  })

  it("loads real context data for the authenticated context bar", async () => {
    const fetchMock = mockLayoutContextApi()
    window.history.pushState({}, "", "/en/app")
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
    window.history.pushState({}, "", "/en/app")
    signIn()

    render(<App />)

    expect(await screen.findByText("Select a workspace")).toBeInTheDocument()
    expect(await screen.findByText("Workspace One")).toBeInTheDocument()
    expect(await screen.findByText("Workspace Two")).toBeInTheDocument()
  })

  it("redirects uninitialized organizations to onboarding", async () => {
    mockOnboardingApi()
    window.history.pushState({}, "", "/en/app")
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
      await screen.findByText(
        "Authenticated layout ready. Page content will migrate in later steps."
      )
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText("New Org")).toBeInTheDocument()
      expect(screen.getByText("Example project")).toBeInTheDocument()
      expect(screen.getByText("Dev")).toBeInTheDocument()
    })
  })
})
