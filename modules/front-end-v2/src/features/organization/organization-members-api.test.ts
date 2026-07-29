import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import { fetchOrganizationMembers } from "./organization-members-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("organization members API", () => {
  beforeEach(() => vi.mocked(fetchApi).mockReset())

  it("loads lightweight organization members with configurable pagination", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ items: [], totalCount: 0 })

    await fetchOrganizationMembers({
      searchText: "maya chen",
      pageIndex: 2,
      pageSize: 30,
    })

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/user/organization-members?searchText=maya+chen&pageIndex=2&pageSize=30"
    )
  })

  it("uses picker pagination defaults", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ items: [], totalCount: 0 })

    await fetchOrganizationMembers({ searchText: "" })

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/user/organization-members?searchText=&pageIndex=0&pageSize=20"
    )
  })
})
