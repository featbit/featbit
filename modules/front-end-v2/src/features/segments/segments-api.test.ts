import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import {
  createSegmentEndUser,
  fetchAllSegmentTags,
  updateSegmentGeneral,
} from "./segments-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("segments tag API", () => {
  beforeEach(() => {
    vi.mocked(fetchApi).mockReset()
  })

  it("loads the environment tag catalog", async () => {
    vi.mocked(fetchApi).mockResolvedValue(["release"])

    await fetchAllSegmentTags("env / 1")

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env%20%2F%201/segments/all-tags"
    )
  })

  it("updates name, description, and tags through the General endpoint", async () => {
    vi.mocked(fetchApi).mockResolvedValue(true)

    await updateSegmentGeneral(
      "env-1",
      "segment-1",
      {
        name: "Release users",
        description: "Updated description",
        tags: ["release", "new-tag"],
      },
      "Organize rollout"
    )

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env-1/segments/segment-1/general",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Release users",
          description: "Updated description",
          tags: ["release", "new-tag"],
          comment: "Organize rollout",
        }),
      }
    )
  })

  it("creates an environment end user for segment targeting", async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      id: "user-1",
      envId: "env / 1",
      keyId: "new-user",
      name: "new-user",
    })

    await createSegmentEndUser("env / 1", "new-user")

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env%20%2F%201/end-users",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: "new-user", name: "new-user" }),
      }
    )
  })
})
