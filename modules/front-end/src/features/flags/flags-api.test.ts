import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import { updateFeatureFlagGeneral } from "./flags-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("flags-api", () => {
  beforeEach(() => {
    vi.mocked(fetchApi).mockReset()
  })

  it("updates name, description, and tags through the General endpoint", async () => {
    vi.mocked(fetchApi).mockResolvedValue("revision-2")

    await updateFeatureFlagGeneral(
      "env/1",
      "checkout flag",
      {
        name: "Checkout rollout",
        description: "Updated description",
        tags: ["checkout", "release"],
      },
      "General settings update"
    )

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env%2F1/feature-flags/checkout%20flag/general",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Checkout rollout",
          description: "Updated description",
          tags: ["checkout", "release"],
          comment: "General settings update",
        }),
      }
    )
  })
})
