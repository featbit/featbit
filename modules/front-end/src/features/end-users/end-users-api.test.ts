import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import { fetchEndUsers, upsertEndUserProperty } from "./end-users-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("end users API", () => {
  beforeEach(() => vi.mocked(fetchApi).mockReset())

  it("posts the environment-scoped cursor list filter", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ items: [] })

    await fetchEndUsers(
      "env-1",
      { searchText: "ada", pageSize: 20 },
      {
        id: "user-1",
        updatedAt: "2026-07-22T12:00:00Z",
        direction: "forward",
      }
    )

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env-1/end-users/list",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          searchText: "ada",
          pageSize: 20,
          cursor: {
            id: "user-1",
            updatedAt: "2026-07-22T12:00:00Z",
            direction: "forward",
          },
        }),
      })
    )
  })

  it("keeps the complete property payload when saving presets", async () => {
    vi.mocked(fetchApi).mockResolvedValue({ id: "property-1" })
    const payload = {
      name: "plan",
      remark: "Subscription plan",
      isDigestField: true,
      usePresetValuesOnly: true,
      presetValues: [
        { id: "preset-1", value: "pro", description: "Professional" },
      ],
    }

    await upsertEndUserProperty("env-1", "property-1", payload)

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env-1/end-user-properties/property-1/upsert",
      expect.objectContaining({ method: "PUT", body: JSON.stringify(payload) })
    )
  })
})
