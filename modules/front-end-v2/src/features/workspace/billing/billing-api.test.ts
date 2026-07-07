import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchSubscription } from "@/features/workspace/billing/billing-api"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("billing api", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("uses fetchApi so billing endpoints refresh expired access tokens", async () => {
    localStorage.setItem("token", "expired-token")
    localStorage.setItem(
      "current-workspace",
      JSON.stringify({ id: "workspace-1", name: "Workspace", key: "workspace" })
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
          data: { plan: "Growth", billingCycle: "monthly", mau: 60000 },
        })
      )

    await expect(fetchSubscription()).resolves.toEqual({
      plan: "Growth",
      billingCycle: "monthly",
      mau: 60000,
    })

    expect(localStorage.getItem("token")).toBe("fresh-token")
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:5000/api/v1/billing/subscription",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-token",
          Organization: "organization-1",
          Workspace: "workspace-1",
        }),
      })
    )
  })
})
