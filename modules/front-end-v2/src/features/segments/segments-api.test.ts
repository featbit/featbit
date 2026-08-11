import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import {
  createSegmentEndUser,
  fetchAllSegmentTags,
  fetchSegmentsByIds,
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

  it("loads referenced segments by id", async () => {
    vi.mocked(fetchApi).mockResolvedValue([])

    await fetchSegmentsByIds("env / 1", ["segment / a", "segment-b"])

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env%20%2F%201/segments/by-ids?ids=segment+%2F+a&ids=segment-b"
    )
  })

  it("loads referenced segments in batches and merges the responses", async () => {
    const segmentIds = Array.from(
      { length: 101 },
      (_, index) => `segment-${index + 1}`
    )
    const firstBatchSegment = { id: "segment-1", name: "First segment" }
    const secondBatchSegment = { id: "segment-101", name: "Last segment" }
    vi.mocked(fetchApi)
      .mockResolvedValueOnce([firstBatchSegment])
      .mockResolvedValueOnce([secondBatchSegment])

    const result = await fetchSegmentsByIds("env-1", segmentIds)

    expect(fetchApi).toHaveBeenCalledTimes(2)
    const firstBatchParams = new URLSearchParams()
    segmentIds
      .slice(0, 100)
      .forEach((segmentId) => firstBatchParams.append("ids", segmentId))
    expect(fetchApi).toHaveBeenNthCalledWith(
      1,
      `/api/v1/envs/env-1/segments/by-ids?${firstBatchParams}`
    )
    expect(fetchApi).toHaveBeenNthCalledWith(
      2,
      "/api/v1/envs/env-1/segments/by-ids?ids=segment-101"
    )
    expect(result).toEqual([firstBatchSegment, secondBatchSegment])
  })
})
