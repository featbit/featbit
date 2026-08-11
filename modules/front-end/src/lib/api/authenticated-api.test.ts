import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiRequestError, fetchApi } from "@/lib/api/authenticated-api"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("authenticated api", () => {
  beforeEach(() => {
    window.env = { API_URL: "http://localhost:5000" }
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("refreshes an expired access token before surfacing unauthorized errors", async () => {
    localStorage.setItem("token", "expired-token")
    localStorage.setItem(
      "current-workspace",
      JSON.stringify({
        id: "workspace-1",
        name: "Workspace",
        key: "workspace",
      })
    )
    localStorage.setItem(
      "current-organization",
      JSON.stringify({
        id: "organization-1",
        name: "Organization",
        key: "organization",
      })
    )

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, errors: ["Unauthorized"] },
          { status: 401, statusText: "Unauthorized" }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: "fresh-token" } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { id: "workspace-1", name: "Workspace", key: "workspace" },
        })
      )

    await expect(fetchApi("/api/v1/workspaces")).resolves.toEqual({
      id: "workspace-1",
      name: "Workspace",
      key: "workspace",
    })

    expect(localStorage.getItem("token")).toBe("fresh-token")
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:5000/api/v1/workspaces",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-token",
          Workspace: "workspace-1",
          Organization: "organization-1",
        }),
      })
    )
  })

  it("reuses a token refreshed by another tab while waiting for the lock", async () => {
    localStorage.setItem("token", "expired-token")

    const refreshTokenLockName = "featbit:refresh-token"
    const requestLock = vi.fn(
      async (
        _name: string,
        callback: (lock: Lock | null) => Promise<string>
      ) => {
        localStorage.setItem("token", "other-tab-token")
        return callback({
          name: refreshTokenLockName,
          mode: "exclusive",
        })
      }
    )
    vi.stubGlobal("navigator", {
      locks: { request: requestLock },
    })

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, errors: ["Unauthorized"] },
          { status: 401, statusText: "Unauthorized" }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { id: "workspace-1" } })
      )

    await expect(fetchApi("/api/v1/workspaces")).resolves.toEqual({
      id: "workspace-1",
    })

    expect(requestLock).toHaveBeenCalledWith(
      refreshTokenLockName,
      expect.any(Function)
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).not.toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/identity/refresh-token",
      expect.anything()
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:5000/api/v1/workspaces",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer other-tab-token",
        }),
      })
    )
  })

  it("expires the session when the refresh token is unauthorized", async () => {
    localStorage.setItem("token", "expired-token")
    localStorage.setItem(
      "auth",
      JSON.stringify({ id: "user-1", email: "test@featbit.com" })
    )
    const sessionExpired = vi.fn()
    window.addEventListener("featbit:session-expired", sessionExpired)

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, errors: ["Unauthorized"] },
          { status: 401, statusText: "Unauthorized" }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, errors: ["Unauthorized"] },
          { status: 401, statusText: "Unauthorized" }
        )
      )

    await expect(fetchApi("/api/v1/workspaces")).rejects.toThrow("Unauthorized")

    expect(localStorage.getItem("token")).toBeNull()
    expect(localStorage.getItem("auth")).toBeNull()
    expect(sessionExpired).toHaveBeenCalledTimes(1)

    window.removeEventListener("featbit:session-expired", sessionExpired)
  })

  it("expires the session when the retried request remains unauthorized", async () => {
    localStorage.setItem("token", "expired-token")

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, errors: ["Unauthorized"] },
          { status: 401, statusText: "Unauthorized" }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: "fresh-token" } })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, errors: ["Unauthorized"] },
          { status: 401, statusText: "Unauthorized" }
        )
      )

    await expect(fetchApi("/api/v1/workspaces")).rejects.toThrow("Unauthorized")

    expect(localStorage.getItem("token")).toBeNull()
  })

  it("preserves the HTTP status on failed requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(
        { success: false, errors: ["Forbidden"] },
        { status: 403, statusText: "Forbidden" }
      )
    )

    await expect(fetchApi("/api/v1/workspaces")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 403,
      message: "Forbidden",
    } satisfies Partial<ApiRequestError>)
  })
})
