import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import { fetchAuditLogs, fetchAuditUsers } from "./audit-logs-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("audit logs API", () => {
  beforeEach(() => {
    vi.mocked(fetchApi).mockReset()
  })

  it("sends all environment audit filters with zero-based pagination", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ items: [], totalCount: 0 })

    await fetchAuditLogs(
      "env / 1",
      {
        query: "checkout",
        creatorId: "user-1",
        refType: "FeatureFlag",
        from: 100,
        to: 200,
      },
      2,
      10
    )

    const url = vi.mocked(fetchApi).mock.calls[0]?.[0] as string
    const parsed = new URL(url, "https://featbit.test")
    expect(parsed.pathname).toBe("/api/v1/envs/env%20%2F%201/audit-logs")
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      crossEnvironment: "false",
      query: "checkout",
      creatorId: "user-1",
      refType: "FeatureFlag",
      refId: "",
      from: "100",
      to: "200",
      pageIndex: "2",
      pageSize: "10",
    })
  })

  it("uses the shared members endpoint for searchable users", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ items: [], totalCount: 0 })

    await fetchAuditUsers("alex chen")

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/members?searchText=alex+chen&pageIndex=0&pageSize=20"
    )
  })
})
