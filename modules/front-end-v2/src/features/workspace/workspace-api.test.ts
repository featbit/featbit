import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchWorkspaceDetails,
  isWorkspaceKeyUsed,
  updateWorkspaceIdentity,
  updateWorkspaceOidcSettings,
} from "@/features/workspace/workspace-api"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("workspace api", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("loads workspace details through the authenticated api", async () => {
    localStorage.setItem("token", "auth-token")

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          id: "workspace-1",
          name: "Workspace",
          key: "workspace",
        },
      })
    )

    await expect(fetchWorkspaceDetails()).resolves.toEqual({
      id: "workspace-1",
      name: "Workspace",
      key: "workspace",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/workspaces",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer auth-token",
          "Content-Type": "application/json",
        }),
      })
    )
  })

  it("persists updated workspace identity in scoped storage", async () => {
    localStorage.setItem("token", "auth-token")
    localStorage.setItem(
      "auth",
      JSON.stringify({ id: "user-1", email: "user@example.com" })
    )

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          id: "workspace-1",
          name: "Updated Workspace",
          key: "updated-workspace",
        },
      })
    )

    await expect(
      updateWorkspaceIdentity({
        id: "workspace-1",
        name: "Updated Workspace",
        key: "updated-workspace",
      })
    ).resolves.toMatchObject({
      id: "workspace-1",
      name: "Updated Workspace",
      key: "updated-workspace",
    })
    expect(localStorage.getItem("current-workspace_user-1")).toBe(
      JSON.stringify({
        id: "workspace-1",
        name: "Updated Workspace",
        key: "updated-workspace",
      })
    )
  })

  it("updates OIDC settings and persists the returned workspace", async () => {
    localStorage.setItem("token", "auth-token")
    localStorage.setItem(
      "auth",
      JSON.stringify({ id: "user-1", email: "user@example.com" })
    )

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          id: "workspace-1",
          name: "Workspace",
          key: "workspace",
          sso: {
            oidc: {
              clientId: "client",
              clientSecret: "secret",
              tokenEndpoint: "https://idp.example.test/token",
              clientAuthenticationMethod: "Client secret basic",
              authorizationEndpoint: "https://idp.example.test/authorize",
              scope: "openid email",
              userEmailClaim: "email",
            },
          },
        },
      })
    )

    await updateWorkspaceOidcSettings({
      id: "workspace-1",
      clientId: "client",
      clientSecret: "secret",
      tokenEndpoint: "https://idp.example.test/token",
      clientAuthenticationMethod: "Client secret basic",
      authorizationEndpoint: "https://idp.example.test/authorize",
      scope: "openid email",
      userEmailClaim: "email",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/workspaces/sso-oidc",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          id: "workspace-1",
          clientId: "client",
          clientSecret: "secret",
          tokenEndpoint: "https://idp.example.test/token",
          clientAuthenticationMethod: "Client secret basic",
          authorizationEndpoint: "https://idp.example.test/authorize",
          scope: "openid email",
          userEmailClaim: "email",
        }),
      })
    )
    expect(localStorage.getItem("current-workspace_user-1")).toContain(
      "Workspace"
    )
  })

  it("encodes workspace key availability checks", async () => {
    localStorage.setItem("token", "auth-token")

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: false,
      })
    )

    await expect(isWorkspaceKeyUsed("example workspace")).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/workspaces/is-key-used?key=example%20workspace",
      expect.anything()
    )
  })
})
