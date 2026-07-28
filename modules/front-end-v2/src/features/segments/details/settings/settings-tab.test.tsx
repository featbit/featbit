import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { fetchAllSegmentTags } from "../../segments-api"
import type { Segment } from "../../segments-types"
import { SettingsTab } from "./settings-tab"

vi.mock("../../segments-api", () => ({
  archiveSegment: vi.fn(),
  fetchAllSegmentTags: vi.fn(),
  removeSegment: vi.fn(),
  restoreSegment: vi.fn(),
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

function renderSettings(value: Segment = segment) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsTab
        envId="env-1"
        segment={value}
        requireComment={false}
        canUpdateName
        canUpdateDescription
        canUpdateTags
        canArchive
        canRestore
        canDelete
        onSaved={vi.fn()}
        onRemoved={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe("SettingsTab actions", () => {
  it("shows Discard only while settings have unsaved changes", async () => {
    vi.mocked(fetchAllSegmentTags).mockResolvedValue([])
    renderSettings()

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

  it("keeps the save actions inside the General section", () => {
    renderSettings()
    const general = screen.getByRole("heading", { name: "General" })
    const generalSection = general.closest("section")
    const lifecycle = screen.getByRole("heading", { name: "Lifecycle" })

    expect(generalSection).toContainElement(
      screen.getByRole("button", { name: "Review & save" })
    )
    expect(generalSection).not.toContainElement(lifecycle)
  })

  it("shows only the archive action for an active segment", () => {
    renderSettings()

    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: "Restore" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Remove permanently" })
    ).not.toBeInTheDocument()
  })

  it("shows restore and permanent removal for an archived segment", () => {
    renderSettings({ ...segment, isArchived: true })

    const restore = screen.getByRole("button", { name: "Restore" })
    const remove = screen.getByRole("button", { name: "Remove permanently" })
    expect(restore).toBeEnabled()
    expect(remove).toBeEnabled()
    expect(restore.parentElement).not.toBe(remove.parentElement)
    expect(screen.getByText("Restore segment")).toBeVisible()
    expect(screen.getByText("Remove segment permanently")).toBeVisible()
    expect(screen.getByLabelText("Name")).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: "Review & save" })
    ).not.toBeInTheDocument()
  })
})
