import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { fetchAllSegmentTags } from "../../segments-api"
import { SegmentTagPicker } from "./segment-tag-picker"

vi.mock("../../segments-api", () => ({
  fetchAllSegmentTags: vi.fn(),
}))

function renderPicker() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Harness() {
    const [tags, setTags] = useState(["current"])
    return (
      <SegmentTagPicker
        envId="env-1"
        tags={tags}
        disabled={false}
        onChange={setTags}
      />
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  )
}

describe("SegmentTagPicker", () => {
  beforeEach(() => {
    vi.mocked(fetchAllSegmentTags).mockReset()
    vi.mocked(fetchAllSegmentTags).mockResolvedValue(["current", "release"])
  })

  it("loads existing tags from the environment endpoint and selects one", async () => {
    renderPicker()

    fireEvent.click(
      screen.getByRole("button", { name: /Search or create tag/ })
    )
    fireEvent.click(await screen.findByRole("option", { name: "release" }))

    expect(fetchAllSegmentTags).toHaveBeenCalledWith("env-1")
    expect(screen.getByText("release")).toBeVisible()
  })

  it("creates a new tag from the search value", async () => {
    renderPicker()

    fireEvent.click(
      screen.getByRole("button", { name: /Search or create tag/ })
    )
    fireEvent.change(
      await screen.findByPlaceholderText("Search or create tag"),
      { target: { value: "new-tag" } }
    )
    fireEvent.click(
      await screen.findByRole("option", { name: 'Create tag "new-tag"' })
    )

    expect(screen.getByText("new-tag")).toBeVisible()
  })
})
