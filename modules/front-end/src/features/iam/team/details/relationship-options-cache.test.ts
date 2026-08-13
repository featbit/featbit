import { describe, expect, it, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import {
  clearRelationshipOptionsCache,
  fetchRelationshipOptions,
  getCachedRelationshipOptions,
  prefetchRelationshipOptions,
} from "./relationship-options-cache"

describe("relationship options cache", () => {
  it("reuses a prefetched first page and clears it after mutations", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const result = {
      items: [{ id: "group-1", name: "Group one" }],
      hasMore: true,
    }
    const loadOptions = vi.fn().mockResolvedValue(result)

    await prefetchRelationshipOptions(
      queryClient,
      "team:member-1:groups",
      loadOptions
    )

    expect(
      getCachedRelationshipOptions(queryClient, "team:member-1:groups", "")
    ).toEqual(result)

    await fetchRelationshipOptions(
      queryClient,
      "team:member-1:groups",
      "",
      loadOptions
    )
    expect(loadOptions).toHaveBeenCalledTimes(1)

    clearRelationshipOptionsCache(queryClient, "team:member-1:groups")
    expect(
      getCachedRelationshipOptions(queryClient, "team:member-1:groups", "")
    ).toBeUndefined()

    await fetchRelationshipOptions(
      queryClient,
      "team:member-1:groups",
      "",
      loadOptions
    )
    expect(loadOptions).toHaveBeenCalledTimes(2)
  })
})
