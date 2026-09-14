import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import {
  archiveMetric,
  fetchMetrics,
  restoreMetric,
  updateMetric,
} from "./metrics-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("metrics API", () => {
  beforeEach(() => vi.mocked(fetchApi).mockReset())

  it("uses server search, lifecycle filtering, and zero-based pagination", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ items: [], totalCount: 0 })

    await fetchMetrics("env / 1", {
      search: "checkout experiment",
      status: "active",
      pageIndex: 2,
      pageSize: 20,
    })

    const url = vi.mocked(fetchApi).mock.calls[0]?.[0] as string
    const parsed = new URL(url, "https://featbit.test")
    expect(parsed.pathname).toBe(
      "/api/v1/envs/env%20%2F%201/experiment-metrics"
    )
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      searchText: "checkout experiment",
      status: "active",
      pageIndex: "2",
      pageSize: "20",
    })
  })

  it("keeps key and status out of metric update payloads", async () => {
    vi.mocked(fetchApi).mockResolvedValue({})

    await updateMetric("env-1", "metric-1", {
      name: "Checkout conversion",
      description: "Completed checkout",
      metricType: "binary",
      metricAgg: "once",
    })

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env-1/experiment-metrics/metric-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          name: "Checkout conversion",
          description: "Completed checkout",
          metricType: "binary",
          metricAgg: "once",
        }),
      })
    )
  })

  it("uses dedicated archive and restore routes", async () => {
    vi.mocked(fetchApi).mockResolvedValue(true)

    await archiveMetric("env / 1", "metric / 1")
    await restoreMetric("env / 1", "metric / 1")

    expect(fetchApi).toHaveBeenNthCalledWith(
      1,
      "/api/v1/envs/env%20%2F%201/experiment-metrics/metric%20%2F%201/archive",
      { method: "PUT" }
    )
    expect(fetchApi).toHaveBeenNthCalledWith(
      2,
      "/api/v1/envs/env%20%2F%201/experiment-metrics/metric%20%2F%201/restore",
      { method: "PUT" }
    )
  })
})
