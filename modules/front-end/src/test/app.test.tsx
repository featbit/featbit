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

      if (url.endsWith("/api/v1/user/policies")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                name: "Organization administrator",
                type: "CustomerManaged",
                statements: [
                  {
                    resourceType: "organization",
                    effect: "allow",
                    actions: ["*"],
                    resources: ["organization/*"],
                  },
                  {
                    resourceType: "iam",
                    effect: "allow",
                    actions: ["CanManageIAM"],
                    resources: ["iam/*"],
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.endsWith("/api/v1/organizations/default-permissions")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { policies: [], groups: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/policies?")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { totalCount: 0, items: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/groups?")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { totalCount: 0, items: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/groups/group-1/members?")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { totalCount: 0, items: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/groups/group-1/policies?")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { totalCount: 0, items: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.endsWith("/api/v1/groups/group-1")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "group-1",
              name: "Group One",
              description: "Test group",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/members?")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              totalCount: 1,
              items: [
                {
                  id: "member-1",
                  name: "Member One",
                  email: "member@example.com",
                  groups: [],
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/members/member-1/groups?")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { totalCount: 0, items: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/members/member-1/direct-policies?")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { totalCount: 0, items: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.includes("/api/v1/members/member-1/inherited-policies?")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { totalCount: 0, items: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.endsWith("/api/v1/members/member-1/policies")) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url.endsWith("/api/v1/members/member-1/permissions")) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url.endsWith("/api/v1/members/member-1")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "member-1",
              name: "Member One",
              email: "member@example.com",
              groups: [],
            },
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

      if (url.endsWith("/api/v1/workspaces")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "ws-real",
              key: "real",
              name: "Real Workspace",
            },
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

  function mockEmptyOrganizationApi(
    canCreateProject: boolean,
    hasExistingProject = false,
    hasAccessibleOtherWorkspace = false,
    canAccessProjects = canCreateProject,
    projectCreateStatus = 200
  ) {
    let projectCreated = hasExistingProject

    return vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input)
        const headers = init?.headers as Record<string, string> | undefined
        const workspaceId = headers?.Workspace ?? ""
        const organizationId = headers?.Organization ?? ""

        if (url.endsWith("/api/v1/user/workspaces")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: [
                { id: "ws-empty", key: "empty", name: "Empty Workspace" },
                { id: "ws-other", key: "other", name: "Other Workspace" },
              ],
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
                  id: workspaceId === "ws-other" ? "org-other" : "org-empty",
                  key: workspaceId === "ws-other" ? "other-org" : "empty-org",
                  name: workspaceId === "ws-other" ? "Other Org" : "Empty Org",
                  initialized: true,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        if (url.endsWith("/api/v1/user/policies")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: canCreateProject
                ? [
                    {
                      name: "Owner",
                      type: "SysManaged",
                      statements: [
                        {
                          resourceType: canAccessProjects ? "*" : "project",
                          effect: "allow",
                          actions: canAccessProjects
                            ? ["*"]
                            : ["CreateProject"],
                          resources: canAccessProjects ? ["*"] : ["project/*"],
                        },
                      ],
                    },
                  ]
                : [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        if (url.endsWith("/api/v1/projects") && init?.method === "POST") {
          if (projectCreateStatus !== 200) {
            return new Response(
              JSON.stringify({ success: false, errors: ["forbidden"] }),
              {
                status: projectCreateStatus,
                headers: { "Content-Type": "application/json" },
              }
            )
          }

          projectCreated = true
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                id: "project-example",
                key: "example-project",
                name: "Example project",
                environments: [
                  {
                    id: "env-prod",
                    projectId: "project-example",
                    key: "prod",
                    name: "Prod",
                  },
                  {
                    id: "env-dev",
                    projectId: "project-example",
                    key: "dev",
                    name: "Dev",
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        if (url.endsWith("/api/v1/projects")) {
          const hasAccessibleProject =
            hasAccessibleOtherWorkspace && organizationId === "org-other"
          return new Response(
            JSON.stringify({
              success: true,
              data:
                projectCreated || hasAccessibleProject
                  ? [
                      {
                        id: hasAccessibleProject
                          ? "project-other"
                          : "project-example",
                        key: hasAccessibleProject
                          ? "other-project"
                          : "example-project",
                        name: hasAccessibleProject
                          ? "Other project"
                          : "Example project",
                        environments: [
                          {
                            id: hasAccessibleProject ? "env-other" : "env-dev",
                            projectId: hasAccessibleProject
                              ? "project-other"
                              : "project-example",
                            key: "dev",
                            name: "Dev",
                          },
                        ],
                      },
                    ]
                  : [],
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

  it("shows SSO on the localized login route without changing the URL", async () => {
    window.history.pushState({}, "", "/en/login")
    mockAuthOptionsApi()

    render(<App />)

    fireEvent.click(
      await screen.findByRole("button", { name: "Sign in with SSO" })
    )

    expect(
      await screen.findByRole("heading", { name: "Sign in with SSO" })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/login")
  })

  it("routes first-time authenticated users to get started", async () => {
    window.history.pushState({}, "", "/en")
    signIn()
    mockLayoutContextApi()

    render(<App />)

    await waitFor(
      () => expect(window.location.pathname).toBe("/en/get-started"),
      { timeout: 3_000 }
    )
    await waitFor(() => {
      expect(localStorage.getItem("get-started")).toBe("true")
    })
  })

  it("routes returning authenticated users to feature flags", async () => {
    window.history.pushState({}, "", "/en")
    signIn()
    localStorage.setItem("get-started", "true")
    mockLayoutContextApi()

    render(<App />)

    await waitFor(
      () => expect(window.location.pathname).toBe("/en/feature-flags"),
      { timeout: 3_000 }
    )
  })

  it("redirects unauthenticated app routes to login", async () => {
    window.history.pushState({}, "", "/en")

    render(<App />)

    expect(
      await screen.findByText("Sign in to your workspace")
    ).toBeInTheDocument()
  })

  it("keeps the session and explains when no environment is accessible", async () => {
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
    expect(localStorage.getItem("token")).toBe("test-token")
    expect(localStorage.getItem("auth")).toContain("user-1")
  })

  it("routes an owner with an empty organization to example project creation", async () => {
    const fetchMock = mockEmptyOrganizationApi(true)
    window.history.pushState({}, "", "/en/feature-flags")
    signIn()
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({
        id: "ws-empty",
        key: "empty",
        name: "Empty Workspace",
      })
    )

    render(<App />)

    expect(
      await screen.findByRole("heading", {
        name: "Create your example project",
      })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/onboarding")
    expect(window.location.search).toBe("?mode=create-example-project")
    expect(localStorage.getItem("token")).toBe("test-token")

    fireEvent.click(screen.getByText("Create project"))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/projects"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Example project",
            key: "example-project",
          }),
        })
      )
    })
    await waitFor(() => {
      expect(localStorage.getItem("current-project_user-1")).toContain(
        '"projectId":"project-example"'
      )
      expect(localStorage.getItem("current-project_user-1")).toContain(
        '"envId":"env-dev"'
      )
    })
    await waitFor(() => {
      expect(window.location.pathname).toBe("/en/get-started")
    })
    expect(
      await screen.findByRole(
        "heading",
        { name: "Get started" },
        { timeout: 3_000 }
      )
    ).toBeInTheDocument()
  })

  it("uses no-access copy when a project creator cannot access any projects", async () => {
    mockEmptyOrganizationApi(true, false, false, false)
    window.history.pushState({}, "", "/en/feature-flags")
    signIn()
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({
        id: "ws-empty",
        key: "empty",
        name: "Empty Workspace",
      })
    )

    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Create a project" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "You don't currently have access to any projects. Create a new project to continue."
      )
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/onboarding")
    expect(window.location.search).toBe("?mode=create-project")
    expect(
      screen.queryByText(/This organization has no projects yet/)
    ).not.toBeInTheDocument()
  })

  it("explains when a permission rule prevents access to the new project", async () => {
    mockEmptyOrganizationApi(true, false, false, false, 403)
    window.history.pushState({}, "", "/en/feature-flags")
    signIn()
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({
        id: "ws-empty",
        key: "empty",
        name: "Empty Workspace",
      })
    )

    render(<App />)

    fireEvent.click(await screen.findByText("Create project"))

    expect(
      await screen.findByText(
        "A permission rule prevents you from accessing this new project or its environments. Ask a workspace administrator to update your permissions, then try again."
      )
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/onboarding")
    expect(localStorage.getItem("token")).toBe("test-token")
  })

  it("uses project-specific copy for other project creation failures", async () => {
    mockEmptyOrganizationApi(true, false, false, false, 500)
    window.history.pushState({}, "", "/en/feature-flags")
    signIn()
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({
        id: "ws-empty",
        key: "empty",
        name: "Empty Workspace",
      })
    )

    render(<App />)

    fireEvent.click(await screen.findByText("Create project"))

    expect(
      await screen.findByText("Unable to create the project. Please try again.")
    ).toBeInTheDocument()
  })

  it("shows permission denied when every workspace is inaccessible", async () => {
    mockEmptyOrganizationApi(false)
    window.history.pushState({}, "", "/en/feature-flags")
    signIn()
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({
        id: "ws-empty",
        key: "empty",
        name: "Empty Workspace",
      })
    )
    localStorage.setItem(
      "current-organization_user-1",
      JSON.stringify({
        id: "org-empty",
        key: "empty-org",
        name: "Empty Org",
      })
    )

    render(<App />)

    expect(await screen.findByText("Permission Denied")).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/login")
    expect(window.location.search).toBe("?reason=permission-denied")
    expect(localStorage.getItem("token")).toBe("test-token")
    expect(localStorage.getItem("current-workspace_user-1")).toBeNull()
    expect(localStorage.getItem("current-organization_user-1")).toBeNull()
  })

  it("returns to workspace selection when another workspace is accessible", async () => {
    mockEmptyOrganizationApi(false, false, true)
    window.history.pushState({}, "", "/en/feature-flags")
    signIn()
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({
        id: "ws-empty",
        key: "empty",
        name: "Empty Workspace",
      })
    )
    localStorage.setItem(
      "current-organization_user-1",
      JSON.stringify({
        id: "org-empty",
        key: "empty-org",
        name: "Empty Org",
      })
    )

    render(<App />)

    expect(await screen.findByText("Select a workspace")).toBeInTheDocument()
    expect(localStorage.getItem("token")).toBe("test-token")
    expect(localStorage.getItem("current-workspace_user-1")).toBeNull()
    expect(localStorage.getItem("current-organization_user-1")).toBeNull()
  })

  it("enters FeatBit when the recovery page finds an existing project", async () => {
    mockEmptyOrganizationApi(true, true)
    window.history.pushState(
      {},
      "",
      "/en/onboarding?mode=create-example-project"
    )
    signIn()
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({
        id: "ws-empty",
        key: "empty",
        name: "Empty Workspace",
      })
    )
    localStorage.setItem(
      "current-organization_user-1",
      JSON.stringify({
        id: "org-empty",
        key: "empty-org",
        name: "Empty Org",
        initialized: true,
      })
    )

    render(<App />)

    await waitFor(() => {
      expect(window.location.pathname).toBe("/en/get-started")
    })
    expect(localStorage.getItem("current-project_user-1")).toContain(
      '"projectId":"project-example"'
    )
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
    window.history.pushState({}, "", "/zh/migration-placeholder")
    signIn()
    mockLayoutContextApi()

    render(<App />)

    expect(
      await screen.findByText("认证布局已就绪，页面内容将在后续步骤迁移。")
    ).toBeInTheDocument()
  })

  it("loads real context data for the authenticated context bar", async () => {
    const fetchMock = mockLayoutContextApi()
    window.history.pushState({}, "", "/en/migration-placeholder")
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

  it("reuses authenticated context while navigating between pages", async () => {
    const fetchMock = mockLayoutContextApi()
    window.history.pushState({}, "", "/en/migration-placeholder")
    signIn()

    render(<App />)

    expect(await screen.findByText("Real Platform")).toBeInTheDocument()

    const countRequests = (matcher: (url: string) => boolean) =>
      fetchMock.mock.calls.filter(([input]) => matcher(String(input))).length

    expect(countRequests((url) => url.includes("/api/v1/organizations"))).toBe(
      1
    )
    expect(countRequests((url) => url.endsWith("/api/v1/projects"))).toBe(1)

    fireEvent.click(screen.getByRole("link", { name: "Experiments" }))

    expect(
      await screen.findByRole("heading", { name: "Experiments" })
    ).toBeInTheDocument()
    expect(countRequests((url) => url.includes("/api/v1/organizations"))).toBe(
      1
    )
    expect(countRequests((url) => url.endsWith("/api/v1/projects"))).toBe(1)
  })

  it("deduplicates the workspace details request in strict mode", async () => {
    const fetchMock = mockLayoutContextApi()
    window.history.pushState({}, "", "/en/workspace")
    signIn()

    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Workspace" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/api/v1/workspaces")
        )
      ).toHaveLength(1)
    })
  })

  it("deduplicates organization settings requests in strict mode", async () => {
    const fetchMock = mockLayoutContextApi()
    window.history.pushState({}, "", "/en/organization")
    signIn()

    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Organization" })
    ).toBeInTheDocument()
    await waitFor(() => {
      const requestUrls = fetchMock.mock.calls.map(([input]) => String(input))
      expect(
        requestUrls.filter((url) =>
          url.includes("/api/v1/organizations?isSsoFirstLogin=false")
        )
      ).toHaveLength(1)
      expect(
        requestUrls.filter((url) =>
          url.endsWith("/api/v1/organizations/default-permissions")
        )
      ).toHaveLength(1)
      expect(
        requestUrls.filter((url) => url.includes("/api/v1/policies?"))
      ).toHaveLength(1)
      expect(
        requestUrls.filter((url) => url.includes("/api/v1/groups?"))
      ).toHaveLength(1)
    })
  })

  it("deduplicates the IAM team member request in strict mode", async () => {
    const fetchMock = mockLayoutContextApi()
    window.history.pushState({}, "", "/en/iam/team")
    signIn()

    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Team" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/api/v1/members?pageIndex=0&pageSize=10")
        )
      ).toHaveLength(1)
    })
  })

  it("opens team member details from the email link", async () => {
    mockLayoutContextApi()
    window.history.pushState({}, "", "/en/iam/team")
    signIn()

    render(<App />)

    fireEvent.click(
      await screen.findByRole("link", { name: "member@example.com" })
    )

    expect(
      await screen.findByRole("heading", { name: "Member One" })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/iam/team/member-1/permissions")
  })

  it("does not load policy resources twice for team relationship counts", async () => {
    const fetchMock = mockLayoutContextApi()
    window.history.pushState({}, "", "/en/iam/team/member-1/permissions")
    signIn()

    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Member One" })
    ).toBeInTheDocument()
    await waitFor(() => {
      const requestUrls = fetchMock.mock.calls.map(([input]) => String(input))
      expect(
        requestUrls.filter((url) =>
          url.endsWith("/api/v1/members/member-1/permissions")
        )
      ).toHaveLength(1)
      expect(
        requestUrls.filter((url) =>
          url.endsWith("/api/v1/members/member-1/policies")
        )
      ).toHaveLength(0)
    })
  })

  it("uses the active group member page to populate its tab count", async () => {
    const fetchMock = mockLayoutContextApi()
    window.history.pushState({}, "", "/en/iam/groups/group-1/team")
    signIn()

    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Group One" })
    ).toBeInTheDocument()
    await waitFor(() => {
      const requestUrls = fetchMock.mock.calls.map(([input]) => String(input))
      expect(
        requestUrls.filter((url) =>
          url.endsWith(
            "/api/v1/groups/group-1/members?getAllMembers=false&pageIndex=0&pageSize=1"
          )
        )
      ).toHaveLength(0)
      expect(
        requestUrls.filter((url) =>
          url.endsWith(
            "/api/v1/groups/group-1/members?getAllMembers=false&pageIndex=0&pageSize=20"
          )
        )
      ).toHaveLength(1)
      expect(
        requestUrls.filter((url) =>
          url.endsWith(
            "/api/v1/groups/group-1/policies?getAllPolicies=false&pageIndex=0&pageSize=1"
          )
        )
      ).toHaveLength(1)
    })
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
      await screen.findByRole("heading", { name: "Get started" })
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe("/en/get-started")
    expect(window.location.search).toBe("?status=init")
    await waitFor(() => {
      expect(screen.getByText("New Org")).toBeInTheDocument()
      expect(screen.getByText("Example project")).toBeInTheDocument()
      expect(screen.getByText("Dev")).toBeInTheDocument()
    })
  })
})
