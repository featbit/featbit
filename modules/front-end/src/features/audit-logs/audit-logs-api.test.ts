import { AuditLogScopes } from "./audit-logs-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import { fetchAuditLogs, fetchAuditUsers } from "./audit-logs-api"

vi.mock("@/lib/api/authenticated-api", () => ({ fetchApi: vi.fn() }))

function lastRequest() {
  return new URL(
    vi.mocked(fetchApi).mock.lastCall![0] as string,
    "https://featbit.test"
  )
}

describe("audit logs API", () => {
  beforeEach(() => vi.mocked(fetchApi).mockReset())

  it("sends environment filters and multiple resource types to the unified endpoint", async () => {
    await fetchAuditLogs(
      {
        scope: AuditLogScopes.Environment,
        scopeId: "env / 1",
        query: "checkout",
        creatorId: "user-1",
        refTypes: ["FeatureFlag", "Segment"],
        from: 0,
        to: 200,
      },
      2,
      10
    )

    const url = lastRequest()
    expect(url.pathname).toBe("/api/v1/audit-logs")
    expect(url.searchParams.getAll("refTypes")).toEqual([
      "FeatureFlag",
      "Segment",
    ])
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      scope: AuditLogScopes.Environment,
      scopeId: "env / 1",
      crossEnvironment: "false",
      query: "checkout",
      creatorId: "user-1",
      from: "0",
      to: "200",
      pageIndex: "2",
      pageSize: "10",
    })
    expect(url.searchParams.has("refType")).toBe(false)
  })

  it("sends explicit organization scope and IAM resource types", async () => {
    await fetchAuditLogs(
      {
        scope: AuditLogScopes.Organization,
        scopeId: "org-1",
        query: "",
        refTypes: ["Member", "Group", "Policy"],
      },
      0,
      10
    )
    const url = lastRequest()
    expect(url.searchParams.get("scope")).toBe("Organization")
    expect(url.searchParams.get("scopeId")).toBe("org-1")
    expect(url.searchParams.getAll("refTypes")).toEqual([
      "Member",
      "Group",
      "Policy",
    ])
  })

  it("preserves shared segment cross-environment history filters", async () => {
    await fetchAuditLogs(
      {
        scope: AuditLogScopes.Environment,
        scopeId: "env-1",
        query: "",
        refTypes: ["Segment"],
        refId: "shared-1",
        crossEnvironment: true,
      },
      0,
      10
    )
    const url = lastRequest()
    expect(url.searchParams.get("crossEnvironment")).toBe("true")
    expect(url.searchParams.get("refId")).toBe("shared-1")
    expect(url.searchParams.getAll("refTypes")).toEqual(["Segment"])
  })

  it("omits resource types so the server applies scope defaults", async () => {
    await fetchAuditLogs(
      { scope: AuditLogScopes.Environment, scopeId: "env-1" },
      0,
      10
    )
    expect(lastRequest().searchParams.has("refTypes")).toBe(false)
  })

  it("uses the shared members endpoint for searchable users", async () => {
    await fetchAuditUsers("alex chen")
    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/members?searchText=alex+chen&pageIndex=0&pageSize=20"
    )
  })
})
