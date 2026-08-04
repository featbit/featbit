import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createOrganization,
  fetchCurrentUserOrganizationPolicies,
  fetchOrganizationDefaultPermissionOptions,
  fetchOrganizationGroups,
  fetchOrganizationPolicies,
  normalizeOrganization,
  updateOrganization,
} from "@/features/organization/organization-api"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("organization api", () => {
  beforeEach(() => {
    window.env = { API_URL: "http://localhost:5000" }
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it("normalizes missing organization settings and permissions", () => {
    expect(
      normalizeOrganization({
        id: "org-1",
        name: "Org",
        key: "org",
      })
    ).toMatchObject({
      id: "org-1",
      settings: {
        flagSortedBy: "created_at",
      },
      defaultPermissions: {
        policyIds: [],
        groupIds: [],
      },
    })
  })

  it("normalizes legacy flag sort values from earlier local state", () => {
    expect(
      normalizeOrganization({
        id: "org-1",
        name: "Org",
        key: "org",
        settings: {
          flagSortedBy: "CreatedAt",
        },
        defaultPermissions: {
          policyIds: [],
          groupIds: [],
        },
      } as never)
    ).toMatchObject({
      settings: {
        flagSortedBy: "created_at",
      },
    })

    expect(
      normalizeOrganization({
        id: "org-1",
        name: "Org",
        key: "org",
        settings: {
          flagSortedBy: "Key",
        },
        defaultPermissions: {
          policyIds: [],
          groupIds: [],
        },
      } as never)
    ).toMatchObject({
      settings: {
        flagSortedBy: "key",
      },
    })
  })

  it("fetches real policy and group options using angular-compatible filters", async () => {
    localStorage.setItem("token", "auth-token")

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            totalCount: 1,
            items: [
              {
                id: "policy-1",
                name: "Owner",
                key: "owner",
                type: "SysManaged",
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            totalCount: 1,
            items: [
              {
                id: "group-1",
                name: "Release Managers",
              },
            ],
          },
        })
      )

    await expect(fetchOrganizationPolicies("own", 50)).resolves.toMatchObject({
      items: [{ id: "policy-1", name: "Owner" }],
    })
    await expect(fetchOrganizationGroups("release", 50)).resolves.toMatchObject(
      {
        items: [{ id: "group-1", name: "Release Managers" }],
      }
    )

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:5000/api/v1/policies?name=own&pageIndex=0&pageSize=50",
      expect.anything()
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:5000/api/v1/groups?name=release&pageIndex=0&pageSize=50",
      expect.anything()
    )
  })

  it("fetches the current user's policies for organization authorization", async () => {
    localStorage.setItem("token", "auth-token")

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [],
      })
    )

    await expect(fetchCurrentUserOrganizationPolicies()).resolves.toEqual([])

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/user/policies",
      expect.anything()
    )
  })

  it("fetches selected default permission names without IAM list access", async () => {
    localStorage.setItem("token", "auth-token")

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          policies: [
            {
              id: "policy-1",
              name: "Developer",
              key: "developer",
              type: "SysManaged",
            },
          ],
          groups: [{ id: "group-1", name: "Release managers" }],
        },
      })
    )

    await expect(fetchOrganizationDefaultPermissionOptions()).resolves.toEqual({
      policies: [
        {
          id: "policy-1",
          name: "Developer",
          key: "developer",
          type: "SysManaged",
        },
      ],
      groups: [{ id: "group-1", name: "Release managers" }],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/organizations/default-permission-options",
      expect.anything()
    )
  })

  it("persists updated organizations and notifies same-tab layout listeners", async () => {
    localStorage.setItem("token", "auth-token")
    localStorage.setItem(
      "auth",
      JSON.stringify({ id: "user-1", email: "user@example.com" })
    )

    const dispatchMock = vi.spyOn(window, "dispatchEvent")
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {},
      })
    )

    await expect(
      updateOrganization(
        {
          id: "org-1",
          name: "Org",
          key: "org",
          settings: {
            flagSortedBy: "created_at",
          },
          defaultPermissions: {
            policyIds: [],
            groupIds: [],
          },
        },
        {
          name: "Updated Org",
          settings: {
            flagSortedBy: "key",
          },
          defaultPermissions: {
            policyIds: ["policy-1"],
            groupIds: ["group-1"],
          },
        }
      )
    ).resolves.toMatchObject({
      name: "Updated Org",
      settings: {
        flagSortedBy: "key",
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/organizations",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          name: "Updated Org",
          settings: {
            flagSortedBy: "key",
          },
          defaultPermissions: {
            policyIds: ["policy-1"],
            groupIds: ["group-1"],
          },
        }),
      })
    )
    expect(localStorage.getItem("current-organization_user-1")).toContain(
      "Updated Org"
    )
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "featbit:organization-changed",
      })
    )
  })

  it("creates and switches to the returned organization context", async () => {
    localStorage.setItem("token", "auth-token")
    localStorage.setItem(
      "auth",
      JSON.stringify({ id: "user-1", email: "user@example.com" })
    )
    localStorage.setItem("current-project_user-1", JSON.stringify({ id: "p1" }))

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          id: "org-2",
          name: "New Org",
          key: "new-org",
          settings: {
            flagSortedBy: "created_at",
          },
          defaultPermissions: {
            policyIds: [],
            groupIds: [],
          },
        },
      })
    )

    await expect(
      createOrganization({
        name: "New Org",
        key: "new-org",
      })
    ).resolves.toMatchObject({
      id: "org-2",
      name: "New Org",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/organizations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "New Org",
          key: "new-org",
        }),
      })
    )
    expect(localStorage.getItem("current-organization_user-1")).toContain(
      "New Org"
    )
    expect(localStorage.getItem("current-project_user-1")).toBeNull()
  })
})
