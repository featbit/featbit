import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  completeLogin,
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
