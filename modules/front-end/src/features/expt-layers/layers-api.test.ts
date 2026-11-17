import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import {
  archiveLayer,
  createLayer,
  fetchLayers,
  restoreLayer,
  updateLayer,
} from "./layers-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("layers API", () => {
  beforeEach(() => vi.mocked(fetchApi).mockReset())

  it("uses the server name-or-key search and zero-based pagination", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ items: [], totalCount: 0 })

    await fetchLayers("env / 1", {
      search: "checkout layer",
      status: "active",
      pageIndex: 2,
      pageSize: 20,
    })

    const url = vi.mocked(fetchApi).mock.calls[0]?.[0] as string
    const parsed = new URL(url, "https://featbit.test")
    expect(parsed.pathname).toBe("/api/v1/envs/env%20%2F%201/experiment-layers")
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      searchText: "checkout layer",
      status: "active",
      pageIndex: "2",
      pageSize: "20",
    })
  })

  it("restores a layer through the dedicated restore endpoint", async () => {
    vi.mocked(fetchApi).mockResolvedValue(true)

    await restoreLayer("env / 1", "layer / 1")

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env%20%2F%201/experiment-layers/layer%20%2F%201/restore",
      { method: "PUT" }
    )
  })

  it("archives a layer through the dedicated archive endpoint", async () => {
    vi.mocked(fetchApi).mockResolvedValue(true)

    await archiveLayer("env / 1", "layer / 1")

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env%20%2F%201/experiment-layers/layer%20%2F%201/archive",
      { method: "PUT" }
    )
  })

  it("uses distinct create and update request bodies", async () => {
    vi.mocked(fetchApi).mockResolvedValue({})

    await createLayer("env-1", {
      name: "Checkout",
      key: "checkout",
      description: "Checkout experiments",
      assignmentUnitSelector: "user.keyId",
    })
    await updateLayer("env-1", "layer-1", {
      name: "Checkout updated",
      description: "Updated description",
      assignmentUnitSelector: "user.keyId",
    })

    expect(fetchApi).toHaveBeenNthCalledWith(
      1,
      "/api/v1/envs/env-1/experiment-layers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Checkout",
          key: "checkout",
          description: "Checkout experiments",
          assignmentUnitSelector: "user.keyId",
        }),
      })
    )
    expect(fetchApi).toHaveBeenNthCalledWith(
      2,
      "/api/v1/envs/env-1/experiment-layers/layer-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          name: "Checkout updated",
          description: "Updated description",
          assignmentUnitSelector: "user.keyId",
        }),
      })
    )
  })
})
