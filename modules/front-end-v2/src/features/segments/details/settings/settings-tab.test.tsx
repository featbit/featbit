import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { fetchAllSegmentTags } from "../../segments-api"
import type { Segment } from "../../segments-types"
import { SettingsTab } from "./settings-tab"

vi.mock("../../segments-api", () => ({
  fetchAllSegmentTags: vi.fn(),
  updateSegmentDescription: vi.fn(),
  updateSegmentName: vi.fn(),
  updateSegmentTags: vi.fn(),
}))

const segment: Segment = {
  id: "segment-1",
  name: "Release users",
  key: "release-users",
  type: "environment-specific",
  scopes: [],
  tags: [],
  description: "",
  updatedAt: "2026-07-24T08:00:00.000Z",
  isArchived: false,
  included: [],
  excluded: [],
  rules: [],
}

describe("SettingsTab actions", () => {
  it("shows Discard only while settings have unsaved changes", async () => {
    vi.mocked(fetchAllSegmentTags).mockResolvedValue([])
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SettingsTab
          envId="env-1"
          segment={segment}
          requireComment={false}
          canUpdateName
          canUpdateDescription
          canUpdateTags
          onSaved={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(
      screen.queryByRole("button", { name: "Discard changes" })
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Updated release users" },
    })

    const discard = await screen.findByRole("button", {
      name: "Discard changes",
    })
    fireEvent.click(discard)

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Discard changes" })
      ).not.toBeInTheDocument()
    )
  })
})
