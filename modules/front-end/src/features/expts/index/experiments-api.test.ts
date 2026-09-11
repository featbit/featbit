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

  it("loads ten experiments with runs in one list request, without fetching details", async () => {
    const controller = new AbortController()
    const run = {
      id: "run-1",
      createdAt: "2026-09-01T00:00:00Z",
      observationStart: "2026-09-01T00:00:00Z",
      observationEnd: null,
      decision: "CONTINUE",
      hasLearning: false,
    }
    vi.mocked(fetchApi).mockResolvedValueOnce({
      items: Array.from({ length: 10 }, (_, index) => ({
        id: String(index),
        name: "Checkout",
        runCount: 1,
        stage: "hypothesis",
        flagKey: "checkout",
        stateSummary: { runs: [run], hasLearning: index === 0 },
      })),
      totalCount: 30,
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

    expect(result.totalCount).toBe(30)
    expect(result.scope).toBe("page")
    expect(result.items).toHaveLength(10)
    expect(result.items.every((item) => item.experimentRuns[0] === run)).toBe(
      true
    )
    expect(result.items[0]?.hasLearning).toBe(true)
    expect(result.items[1]?.hasLearning).toBe(false)
    expect(fetchApi).toHaveBeenCalledTimes(1)
    expect(fetchApi).toHaveBeenLastCalledWith(
      "/api/v1/envs/env-1/experiments?pageIndex=2&pageSize=10",
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
      stateSummary: { runs: [], hasLearning: false },
    }))
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({ items: firstPage, totalCount: 101 })
      .mockResolvedValueOnce({
        items: [
          {
            id: "last",
            runCount: 1,
            stateSummary: { runs: [{ id: "run-1" }], hasLearning: false },
          },
        ],
        totalCount: 101,
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
    expect(result.items.at(-1)?.experimentRuns).toEqual([{ id: "run-1" }])
    expect(result.items[0]?.experimentRuns).toEqual([])
    expect(result.scope).toBe("all")
    expect(fetchApi).toHaveBeenCalledTimes(2)
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

  it("surfaces a list read failure", async () => {
    vi.mocked(fetchApi).mockRejectedValueOnce(new Error("List unavailable"))

    await expect(
      fetchExperimentList("env-1", {
        name: "",
        flagKey: "",
        scope: "page",
        pageIndex: 0,
        pageSize: 10,
      })
    ).rejects.toThrow("List unavailable")
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

  it("does not load another list page after cancellation", async () => {
    const controller = new AbortController()
    let completeBatch!: (value: unknown) => void
    const batchRequest = new Promise((resolve) => {
      completeBatch = resolve
    })
    vi.mocked(fetchApi).mockReturnValueOnce(batchRequest)

    const request = fetchExperimentList(
      "env-1",
      { name: "", flagKey: "", scope: "all", pageIndex: 0, pageSize: 10 },
      controller.signal
    )
    const cancelled = expect(request).rejects.toThrow()
    await vi.waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(1))
    controller.abort()
    completeBatch({
      items: Array.from({ length: 100 }, (_, index) => ({
        id: String(index),
        stateSummary: { runs: [], hasLearning: false },
      })),
      totalCount: 101,
    })
    await cancelled
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })
})
