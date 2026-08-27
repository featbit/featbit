import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import { fetchEvaluatedEndUsers } from "./insights-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("insights API", () => {
  beforeEach(() => vi.mocked(fetchApi).mockReset())

  it("requests evaluated users from the current stats endpoint", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ totalCount: 0, items: [] })

    await fetchEvaluatedEndUsers("env/1", {
      from: 1,
      to: 2,
      featureFlagKey: "change request",
      variationId: "variation-1",
      query: "Ada Lovelace",
      pageIndex: 2,
      pageSize: 10,
    })

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env%2F1/end-users/stats?from=1&to=2&featureFlagKey=change+request&variationId=variation-1&query=Ada+Lovelace&pageIndex=1&pageSize=10"
    )
  })
})
