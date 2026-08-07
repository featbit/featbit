import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchSegments,
  fetchSegmentsByIds,
} from "@/features/segments/segments-api"
import type { Segment } from "@/features/segments/segments-types"
import "@/lib/i18n/i18n"
import { SegmentConditionPicker } from "./segment-condition-picker"

vi.mock("@/features/segments/segments-api", () => ({
  fetchSegments: vi.fn(),
  fetchSegmentsByIds: vi.fn(),
}))

window.HTMLElement.prototype.scrollIntoView = vi.fn()

function segment(id: string, name: string): Segment {
  return {
    id,
    name,
    key: name.toLocaleLowerCase().replaceAll(" ", "-"),
    type: "environment-specific",
    scopes: [],
    tags: [],
    description: "",
    updatedAt: "2026-08-07T00:00:00Z",
    isArchived: false,
    included: [],
    excluded: [],
    rules: [],
  }
}

function renderPicker() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Harness() {
    const [value, setValue] = useState("[]")
    return (
      <>
        <SegmentConditionPicker
          envId="env-1"
          value={value}
          disabled={false}
          onValueChange={setValue}
        />
        <output>{value}</output>
      </>
    )
  }

  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  )
}

describe("SegmentConditionPicker", () => {
  beforeEach(() => {
    vi.mocked(fetchSegments).mockReset()
    vi.mocked(fetchSegmentsByIds).mockReset()
    vi.mocked(fetchSegments).mockResolvedValue({
      items: [segment("segment-a", "Alpha users")],
      totalCount: 1,
    })
    vi.mocked(fetchSegmentsByIds).mockImplementation(async (_, ids) =>
      ids.map((id) => segment(id, id === "segment-a" ? "Alpha users" : id))
    )
  })

  it("searches and serializes selected segment ids", async () => {
    renderPicker()

    fireEvent.click(screen.getByRole("combobox", { name: "Select segments" }))
    fireEvent.change(await screen.findByPlaceholderText("Search segments"), {
      target: { value: "Alpha" },
    })

    await waitFor(() =>
      expect(fetchSegments).toHaveBeenLastCalledWith("env-1", {
        name: "Alpha",
        isArchived: false,
        pageIndex: 0,
        pageSize: 20,
      })
    )
    fireEvent.click(await screen.findByRole("option", { name: /Alpha users/ }))

    expect(screen.getByText('["segment-a"]')).toBeVisible()
    await waitFor(() =>
      expect(fetchSegmentsByIds).toHaveBeenCalledWith("env-1", ["segment-a"])
    )
  })
})
