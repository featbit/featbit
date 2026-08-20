import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { ApiRequestError } from "@/lib/api/authenticated-api"
import { toast } from "sonner"
import { fetchAllSegmentTags, updateSegmentGeneral } from "../../segments-api"
import type { Segment } from "../../segments-types"
import { SettingsTab } from "./settings-tab"

vi.mock("../../segments-api", () => ({
  archiveSegment: vi.fn(),
  fetchAllSegmentTags: vi.fn(),
  removeSegment: vi.fn(),
  restoreSegment: vi.fn(),
  updateSegmentGeneral: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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

function renderSettings(
  value: Segment = segment,
  permissions: Partial<{
    canUpdateName: boolean
    canUpdateDescription: boolean
    canUpdateTags: boolean
  }> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onSaved = vi.fn()
  const generalPermissions = {
    canUpdateName: true,
    canUpdateDescription: true,
    canUpdateTags: true,
    ...permissions,
  }

  const result = render(
    <QueryClientProvider client={queryClient}>
      <SettingsTab
        envId="env-1"
        segment={value}
        requireComment={false}
        canUpdateName={generalPermissions.canUpdateName}
        canUpdateDescription={generalPermissions.canUpdateDescription}
        canUpdateTags={generalPermissions.canUpdateTags}
        canArchive
        canRestore
        canDelete
        onSaved={onSaved}
        onRemoved={vi.fn()}
      />
    </QueryClientProvider>
  )
  return { ...result, onSaved }
}

describe("SettingsTab actions", () => {
  beforeEach(() => {
    vi.mocked(fetchAllSegmentTags).mockReset()
    vi.mocked(fetchAllSegmentTags).mockResolvedValue([])
    vi.mocked(updateSegmentGeneral).mockReset()
    vi.mocked(toast.error).mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it("keeps Description editable when it is the only granted General permission", () => {
    renderSettings(segment, {
      canUpdateName: false,
      canUpdateDescription: true,
      canUpdateTags: false,
    })

    expect(screen.getByLabelText("Name")).toBeDisabled()
    expect(screen.getByLabelText(/Description/)).toBeEnabled()
  })

  it("shows Discard only while settings have unsaved changes", async () => {
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

  it("opens review for a clean draft and keeps save disabled", async () => {
    renderSettings()

    const review = screen.getByRole("button", { name: "Review & save" })
    expect(review).toBeEnabled()
    fireEvent.click(review)

    expect(
      await screen.findByRole("button", { name: "Save changes" })
    ).toBeDisabled()
  })

  it("reports missing IAM permission without disabling review", async () => {
    renderSettings(segment, {
      canUpdateName: false,
      canUpdateDescription: false,
      canUpdateTags: false,
    })

    const review = screen.getByRole("button", { name: "Review & save" })
    expect(review).toBeEnabled()
    fireEvent.click(review)

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "You do not have permission to perform this action."
      )
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
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

  it("saves General changes with one combined request", async () => {
    vi.mocked(updateSegmentGeneral).mockResolvedValue(true)
    const { onSaved } = renderSettings()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Updated release users" },
    })
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Updated description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review & save" }))
    fireEvent.click(await screen.findByRole("button", { name: "Save changes" }))

    await waitFor(() =>
      expect(updateSegmentGeneral).toHaveBeenCalledWith(
        "env-1",
        "segment-1",
        {
          name: "Updated release users",
          description: "Updated description",
          tags: [],
        },
        ""
      )
    )
    expect(onSaved).toHaveBeenCalledWith({
      ...segment,
      name: "Updated release users",
      description: "Updated description",
      tags: [],
    })
  })

  it("preserves an unchanged stored name with trailing whitespace", async () => {
    vi.mocked(updateSegmentGeneral).mockResolvedValue(true)
    const storedSegment = {
      ...segment,
      name: "Release users ",
      description: "Original description",
    }
    renderSettings(storedSegment, {
      canUpdateName: false,
      canUpdateDescription: true,
      canUpdateTags: false,
    })

    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Updated description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review & save" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Description")).toBeVisible()
    expect(within(dialog).queryByText("Name")).not.toBeInTheDocument()
    const segmentName = within(dialog).getByText("Release users")
    expect(segmentName.tagName).toBe("STRONG")
    expect(segmentName).toHaveClass("font-semibold", "text-foreground")
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" })
    )

    await waitFor(() =>
      expect(updateSegmentGeneral).toHaveBeenCalledWith(
        "env-1",
        "segment-1",
        {
          name: "Release users ",
          description: "Updated description",
          tags: [],
        },
        ""
      )
    )
  })

  it("shows a permission error when the General update returns 403", async () => {
    vi.mocked(updateSegmentGeneral).mockRejectedValue(
      new ApiRequestError(403, "Forbidden")
    )
    const { onSaved } = renderSettings()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Updated release users" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review & save" }))
    fireEvent.click(await screen.findByRole("button", { name: "Save changes" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "You do not have permission to perform this action."
      )
    )
    expect(onSaved).not.toHaveBeenCalled()
  })
})
