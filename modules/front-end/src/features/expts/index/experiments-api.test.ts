import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import {
  createExperiment,
  fetchExperimentList,
  fetchExperiments,
} from "./experiments-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("experiments API", () => {
  beforeEach(() => {
    vi.mocked(fetchApi).mockReset()
  })

  it("uses name and flag filters with zero-based pagination, never the stored stage", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ items: [], totalCount: 0 })

    await fetchExperiments("env / 1", {
      name: "checkout",
      flagKey: "checkout-redesign",
      pageIndex: 1,
      pageSize: 20,
    })

    const url = vi.mocked(fetchApi).mock.calls[0]?.[0] as string
    const parsed = new URL(url, "https://featbit.test")
    expect(parsed.pathname).toBe("/api/v1/envs/env%20%2F%201/experiments")
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      pageIndex: "1",
      pageSize: "20",
      name: "checkout",
      flagKey: "checkout-redesign",
    })
  })

  it("reads run details for display without writing stage or loading no-run details", async () => {
    const controller = new AbortController()
    const summary = {
      id: "with / run",
      name: "Checkout",
      runCount: 1,
      stage: "hypothesis",
      flagKey: "checkout",
    }
    const run = {
      id: "run-1",
      observationStart: "2026-09-01T00:00:00Z",
      decision: "CONTINUE",
    }
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        items: [summary, { ...summary, id: "no-run", runCount: 0 }],
        totalCount: 20,
      })
      .mockResolvedValueOnce({
        flagKey: "checkout",
        experimentRuns: [run],
        lastLearning: null,
      })

    const result = await fetchExperimentList(
      "env-1",
      {
        name: "",
        flagKey: "",
        scope: "page",
        pageIndex: 2,
        pageSize: 10,
      },
      controller.signal
    )

    expect(result.totalCount).toBe(20)
    expect(result.scope).toBe("page")
    expect(result.items[0]?.experimentRuns).toEqual([run])
    expect(result.items[1]?.experimentRuns).toEqual([])
    expect(fetchApi).toHaveBeenCalledTimes(2)
    expect(fetchApi).toHaveBeenLastCalledWith(
      "/api/v1/envs/env-1/experiments/with%20%2F%20run",
      { signal: controller.signal }
    )
    expect(
      vi
        .mocked(fetchApi)
        .mock.calls.every(([, init]) => init?.signal === controller.signal)
    ).toBe(true)
    expect(
      vi
        .mocked(fetchApi)
        .mock.calls.every(([, init]) => !init?.method || init.method === "GET")
    ).toBe(true)
  })

  it("loads every matching server page for derived stage filtering", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: String(index),
      runCount: 0,
    }))
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({ items: firstPage, totalCount: 101 })
      .mockResolvedValueOnce({
        items: [{ id: "last", runCount: 1 }],
        totalCount: 101,
      })
      .mockResolvedValueOnce({
        flagKey: "checkout",
        experimentRuns: [{ id: "run-1" }],
        lastLearning: null,
      })

    const result = await fetchExperimentList("env-1", {
      name: "checkout",
      flagKey: "checkout",
      scope: "all",
      pageIndex: 2,
      pageSize: 10,
    })

    expect(result.items).toHaveLength(101)
    expect(result.items.at(-1)?.id).toBe("last")
    expect(result.scope).toBe("all")
    const listRequests = vi
      .mocked(fetchApi)
      .mock.calls.slice(0, 2)
      .map(([path]) => new URL(path, "https://featbit.test"))
    expect(
      listRequests.map((url) => url.searchParams.get("pageIndex"))
    ).toEqual(["0", "1"])
    for (const url of listRequests) {
      expect(url.searchParams.get("stage")).toBeNull()
      expect(url.searchParams.get("name")).toBe("checkout")
      expect(url.searchParams.get("flagKey")).toBe("checkout")
      expect(url.searchParams.get("pageSize")).toBe("100")
    }
  })

  it("surfaces a detail read failure rather than falling back to the stale stage", async () => {
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        items: [{ id: "experiment-1", runCount: 1 }],
        totalCount: 1,
      })
      .mockRejectedValueOnce(new Error("Detail unavailable"))

    await expect(
      fetchExperimentList("env-1", {
        name: "",
        flagKey: "",
        scope: "page",
        pageIndex: 0,
        pageSize: 10,
      })
    ).rejects.toThrow("Detail unavailable")
  })

  it("keeps creation limited to name, description, and project key", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ id: "experiment-1" })
    const payload = {
      name: "Checkout recommendation",
      description: null,
      featBitProjectKey: "ecommerce",
    }

    await createExperiment("env-1", payload)

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env-1/experiments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    )
  })

  it("does not start another detail batch after cancellation", async () => {
    const controller = new AbortController()
    let completeBatch!: (value: unknown) => void
    const batchRequest = new Promise((resolve) => {
      completeBatch = resolve
    })
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        items: Array.from({ length: 6 }, (_, index) => ({
          id: String(index),
          runCount: 1,
        })),
        totalCount: 6,
      })
      .mockReturnValue(batchRequest)

    const request = fetchExperimentList(
      "env-1",
      { name: "", flagKey: "", scope: "page", pageIndex: 0, pageSize: 10 },
      controller.signal
    )
    const cancelled = expect(request).rejects.toThrow()
    await vi.waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(6))
    controller.abort()
    completeBatch({ experimentRuns: [], flagKey: null, lastLearning: null })
    await cancelled
    expect(fetchApi).toHaveBeenCalledTimes(6)
  })
})
