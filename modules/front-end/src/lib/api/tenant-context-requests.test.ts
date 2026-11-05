import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "./authenticated-api"
import {
  fetchOrganizations,
  fetchWorkspaces,
} from "@/features/layout/layout-context"
import { resetPassword, updateProfile } from "@/features/profile/profile-api"

function response(data: unknown = []) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 })
}

describe("request tenant context", () => {
  beforeEach(() => {
    window.env = { API_URL: "http://localhost:5000" }
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem("auth", JSON.stringify({ id: "user-1" }))
    localStorage.setItem("token", "token")
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({ id: "new-workspace" })
    )
    localStorage.setItem(
      "current-organization_user-1",
      JSON.stringify({ id: "stale-organization" })
    )
  })

  afterEach(() => vi.restoreAllMocks())

  it("omits stale tenant context from workspace discovery and account operations", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => response({ id: "user-1", name: "User" }))
    await fetchWorkspaces()
    await updateProfile({ name: "User", email: "user@example.com" })
    await resetPassword({ currentPassword: "old", newPassword: "new" })
    for (const [, init] of fetchMock.mock.calls) {
      const headers = new Headers(init?.headers)
      expect(headers.get("Authorization")).toBe("Bearer token")
      expect(headers.has("Workspace")).toBe(false)
      expect(headers.has("Organization")).toBe(false)
      expect(init).not.toHaveProperty("tenantContext")
    }
  })

  it("lists organizations with only the selected workspace and keeps business requests scoped", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => response())
    await fetchOrganizations()
    await fetchApi("/api/v1/projects")
    const selection = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(selection.get("Workspace")).toBe("new-workspace")
    expect(selection.has("Organization")).toBe(false)
    const business = new Headers(fetchMock.mock.calls[1][1]?.headers)
    expect(business.get("Workspace")).toBe("new-workspace")
    expect(business.get("Organization")).toBe("stale-organization")
  })

  it.each(["none", "workspace"] as const)(
    "preserves %s context on token refresh and filters explicit headers",
    async (tenantContext) => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(response({ token: "fresh" }))
        .mockResolvedValueOnce(response())
      await fetchApi("/test", {
        tenantContext,
        headers: new Headers({
          workspace: "explicit-workspace",
          organization: "explicit-org",
          "X-Test": "value",
        }),
      })
      for (const index of [0, 2]) {
        const headers = new Headers(fetchMock.mock.calls[index][1]?.headers)
        expect(headers.has("Organization")).toBe(false)
        expect(headers.get("Workspace")).toBe(
          tenantContext === "none" ? null : "explicit-workspace"
        )
        expect(headers.get("X-Test")).toBe("value")
      }
      expect(
        new Headers(fetchMock.mock.calls[2][1]?.headers).get("Authorization")
      ).toBe("Bearer fresh")
    }
  )
})
