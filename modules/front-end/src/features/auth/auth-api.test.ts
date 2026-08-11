import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  completeLogin,
  getAuthSessionId,
  getIdentityToken,
  getRememberedEmail,
  getStoredUserProfile,
  signOutCurrentTab,
} from "@/features/auth/auth-api"

describe("auth persistence", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "user-1", email: "user@example.com" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    )
  })

  it("stores auth token in localStorage and forgets email when remember-email is off", async () => {
    const navigate = vi.fn()

    localStorage.setItem("remembered-email", "old@example.com")

    await completeLogin(
      { success: true, data: { token: "auth-token" } },
      navigate,
      "/en",
      { email: "user@example.com", rememberMe: false }
    )

    expect(localStorage.getItem("token")).toBe("auth-token")
    expect(sessionStorage.getItem("token")).toBeNull()
    expect(getIdentityToken()).toBe("auth-token")
    expect(getRememberedEmail()).toBe("")
    expect(navigate).toHaveBeenCalledWith("/en")
  })

  it("stores auth token and remembered email when remember-email is on", async () => {
    const navigate = vi.fn()

    await completeLogin(
      { success: true, data: { token: "auth-token" } },
      navigate,
      "/en",
      { email: "user@example.com", rememberMe: true }
    )

    expect(localStorage.getItem("token")).toBe("auth-token")
    expect(sessionStorage.getItem("token")).toBeNull()
    expect(getIdentityToken()).toBe("auth-token")
    expect(getRememberedEmail()).toBe("user@example.com")
    expect(navigate).toHaveBeenCalledWith("/en")
  })

  it("creates a new authentication session for every completed login", async () => {
    await completeLogin(
      { success: true, data: { token: "first-token" } },
      vi.fn(),
      "/en"
    )
    const firstSessionId = getAuthSessionId()

    await completeLogin(
      { success: true, data: { token: "second-token" } },
      vi.fn(),
      "/en"
    )

    const secondSessionId = getAuthSessionId()

    expect(firstSessionId).not.toBe("")
    expect(secondSessionId).not.toBe("")
    expect(secondSessionId).not.toBe(firstSessionId)
  })

  it("ignores a stale login that completes after a newer login", async () => {
    let resolveFirstProfile!: (response: Response) => void
    let resolveSecondProfile!: (response: Response) => void
    const firstProfile = new Promise<Response>((resolve) => {
      resolveFirstProfile = resolve
    })
    const secondProfile = new Promise<Response>((resolve) => {
      resolveSecondProfile = resolve
    })
    vi.mocked(fetch)
      .mockImplementationOnce(() => firstProfile)
      .mockImplementationOnce(() => secondProfile)

    const firstNavigate = vi.fn()
    const secondNavigate = vi.fn()
    const firstLogin = completeLogin(
      { success: true, data: { token: "first-token" } },
      firstNavigate,
      "/first"
    )
    const secondLogin = completeLogin(
      { success: true, data: { token: "second-token" } },
      secondNavigate,
      "/second"
    )

    resolveSecondProfile(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "user-2", email: "second@example.com" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    await secondLogin
    const secondSessionId = getAuthSessionId()

    resolveFirstProfile(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "user-1", email: "first@example.com" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    await firstLogin

    expect(getIdentityToken()).toBe("second-token")
    expect(getStoredUserProfile()).toEqual({
      id: "user-2",
      email: "second@example.com",
    })
    expect(getAuthSessionId()).toBe(secondSessionId)
    expect(secondSessionId).not.toBe("")
    expect(firstNavigate).not.toHaveBeenCalled()
    expect(secondNavigate).toHaveBeenCalledWith("/second")
  })

  it("signs out only the current tab and restores it after login", async () => {
    localStorage.setItem("token", "shared-token")
    localStorage.setItem(
      "auth",
      JSON.stringify({ id: "user-1", email: "user@example.com" })
    )

    signOutCurrentTab()

    expect(localStorage.getItem("token")).toBe("shared-token")
    expect(localStorage.getItem("auth")).toContain("user-1")
    expect(sessionStorage.getItem("featbit:tab-signed-out")).toBe("true")
    expect(getIdentityToken()).toBeNull()
    expect(getStoredUserProfile()).toEqual({})

    await completeLogin(
      { success: true, data: { token: "new-token" } },
      vi.fn(),
      "/en"
    )

    expect(sessionStorage.getItem("featbit:tab-signed-out")).toBeNull()
    expect(getIdentityToken()).toBe("new-token")
  })

  it("keeps previous workspace, organization, and project selections after login", async () => {
    const navigate = vi.fn()

    localStorage.setItem("current-workspace", JSON.stringify({ id: "old-ws" }))
    localStorage.setItem(
      "current-organization",
      JSON.stringify({ id: "old-org" })
    )
    localStorage.setItem(
      "current-project",
      JSON.stringify({ id: "old-project" })
    )
    localStorage.setItem(
      "current-workspace_user-1",
      JSON.stringify({ id: "old-scoped-ws" })
    )
    localStorage.setItem(
      "current-organization_user-1",
      JSON.stringify({ id: "old-scoped-org" })
    )
    localStorage.setItem(
      "current-project_user-1",
      JSON.stringify({ id: "old-scoped-project" })
    )

    await completeLogin(
      { success: true, data: { token: "auth-token" } },
      navigate,
      "/en"
    )

    expect(localStorage.getItem("current-workspace")).toBe(
      JSON.stringify({ id: "old-ws" })
    )
    expect(localStorage.getItem("current-organization")).toBe(
      JSON.stringify({ id: "old-org" })
    )
    expect(localStorage.getItem("current-project")).toBe(
      JSON.stringify({ id: "old-project" })
    )
    expect(localStorage.getItem("current-workspace_user-1")).toBe(
      JSON.stringify({ id: "old-scoped-ws" })
    )
    expect(localStorage.getItem("current-organization_user-1")).toBe(
      JSON.stringify({ id: "old-scoped-org" })
    )
    expect(localStorage.getItem("current-project_user-1")).toBe(
      JSON.stringify({ id: "old-scoped-project" })
    )
  })
})
