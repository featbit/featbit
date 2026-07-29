import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import {
  createChangeRequest,
  deleteChangeRequest,
  fetchChangeRequestPreview,
  fetchChangeRequests,
  performChangeRequestAction,
} from "./change-requests-api"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

describe("change requests API", () => {
  beforeEach(() => vi.mocked(fetchApi).mockReset())

  it("sends environment filters with zero-based pagination", async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      items: [],
      totalCount: 0,
      needsReviewCount: 0,
    })

    await fetchChangeRequests(
      "env / 1",
      {
        query: "after QA",
        creatorId: "author-1",
        reviewerId: "reviewer-1",
        status: "PendingReview",
      },
      2,
      20
    )

    const url = vi.mocked(fetchApi).mock.calls[0]?.[0] as string
    const parsed = new URL(url, "https://featbit.test")
    expect(parsed.pathname).toBe("/api/v1/envs/env%20%2F%201/change-requests")
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      query: "after QA",
      creatorId: "author-1",
      reviewerId: "reviewer-1",
      status: "PendingReview",
      pageIndex: "2",
      pageSize: "20",
    })
  })

  it("loads a read-only targeting preview from the centralized controller", async () => {
    vi.mocked(fetchApi).mockResolvedValue({})

    await fetchChangeRequestPreview("env / 1", "request / 1")

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env%20%2F%201/change-requests/request%20%2F%201/preview"
    )
  })

  it("creates through the centralized controller", async () => {
    vi.mocked(fetchApi).mockResolvedValue(true)
    const input = {
      targeting: {
        disabledVariationId: "variation-off",
        targetUsers: [],
        rules: [],
        fallthrough: { variations: [] },
        exptIncludeAllTargets: false,
      },
      revision: "revision-1",
      reviewers: ["reviewer-1"],
      reason: "Ready for review",
    }

    await createChangeRequest("env-1", "checkout / v2", input)

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env-1/change-requests/checkout%20%2F%20v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    )
  })

  it.each(["approve", "decline", "apply"] as const)(
    "sends the %s action to the centralized controller",
    async (action) => {
      vi.mocked(fetchApi).mockResolvedValue(true)

      await performChangeRequestAction("env-1", "request-1", action)

      expect(fetchApi).toHaveBeenCalledWith(
        `/api/v1/envs/env-1/change-requests/request-1/${action}`,
        { method: "PUT" }
      )
    }
  )

  it("deletes through the centralized controller", async () => {
    vi.mocked(fetchApi).mockResolvedValue(true)

    await deleteChangeRequest("env-1", "request / 1")

    expect(fetchApi).toHaveBeenCalledWith(
      "/api/v1/envs/env-1/change-requests/request%20%2F%201",
      { method: "DELETE" }
    )
  })
})
