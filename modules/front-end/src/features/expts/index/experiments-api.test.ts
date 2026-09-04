import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import { createExperiment, fetchExperiments } from "./experiments-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("experiments API", () => {
  beforeEach(() => vi.mocked(fetchApi).mockReset())

  it("uses server filters and zero-based pagination", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ items: [], totalCount: 0 })

    await fetchExperiments("env / 1", {
      name: "checkout",
      flagKey: "checkout-redesign",
      stage: "measuring",
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
      stage: "measuring",
    })
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
})
