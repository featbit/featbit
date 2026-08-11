import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchSegmentsByIds } from "@/features/segments/segments-api"
import type { Segment } from "@/features/segments/segments-types"
import { useCachedSegmentNames } from "./audit-log-table-adapter"

vi.mock("@/features/segments/segments-api", () => ({
  fetchSegmentsByIds: vi.fn(),
}))

function segment(id: string, name: string) {
  return { id, name } as Segment
}

describe("useCachedSegmentNames", () => {
  beforeEach(() => {
    vi.mocked(fetchSegmentsByIds).mockReset()
  })

  it("requests only newly loaded segment ids and retains cached names", async () => {
    vi.mocked(fetchSegmentsByIds)
      .mockResolvedValueOnce([
        segment("segment-a", "Segment A"),
        segment("segment-b", "Segment B"),
      ])
      .mockResolvedValueOnce([segment("segment-c", "Segment C")])

    const { result, rerender } = renderHook(
      ({ ids }) => useCachedSegmentNames("env-1", ids),
      { initialProps: { ids: ["segment-a", "segment-b"] } }
    )

    await waitFor(() => {
      expect(result.current.get("segment-a")).toBe("Segment A")
    })
    expect(fetchSegmentsByIds).toHaveBeenNthCalledWith(1, "env-1", [
      "segment-a",
      "segment-b",
    ])

    rerender({ ids: ["segment-a", "segment-b", "segment-c"] })

    await waitFor(() => {
      expect(result.current.get("segment-c")).toBe("Segment C")
    })
    expect(fetchSegmentsByIds).toHaveBeenCalledTimes(2)
    expect(fetchSegmentsByIds).toHaveBeenNthCalledWith(2, "env-1", [
      "segment-c",
    ])
    expect([...result.current.entries()]).toEqual([
      ["segment-a", "Segment A"],
      ["segment-b", "Segment B"],
      ["segment-c", "Segment C"],
    ])
  })
})
