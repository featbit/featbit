import { MemoryRouter } from "react-router-dom"
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
import {
  fetchRunningExperiments,
  updateFeatureFlagGeneral,
  updateFeatureFlagInsightCollection,
} from "../../flags-api"
import type { FeatureFlag } from "../../flags-types"
import { SettingsTab } from "./settings-tab"

vi.mock("../../flags-api", () => ({
  archiveFeatureFlag: vi.fn(),
  removeFeatureFlag: vi.fn(),
  restoreFeatureFlag: vi.fn(),
  updateFeatureFlagGeneral: vi.fn(),
  updateFeatureFlagInsightCollection: vi.fn(),
  fetchFeatureFlagTags: vi.fn().mockResolvedValue([]),
  fetchRunningExperiments: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout redesign",
  key: "checkout-redesign",
  description: "Release gradually",
  tags: ["checkout"],
  isEnabled: true,
  isArchived: false,
  createdAt: "2026-07-27T08:00:00.000Z",
  updatedAt: "2026-07-27T08:00:00.000Z",
  variationType: "boolean",
}

function renderSettings(
  value: FeatureFlag = flag,
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
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <SettingsTab
          envId="env-1"
          flag={value}
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
    </MemoryRouter>
  )
  return { ...result, onSaved }
}

describe("SettingsTab", () => {
  beforeEach(() => {
    vi.mocked(updateFeatureFlagGeneral).mockReset()
    vi.mocked(updateFeatureFlagInsightCollection).mockReset()
    vi.mocked(fetchRunningExperiments).mockReset()
    vi.mocked(fetchRunningExperiments).mockResolvedValue([])
    vi.mocked(toast.error).mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it("separates Insights from General and shares the settings save action", () => {
    renderSettings()
    const general = screen.getByRole("heading", { name: "General" })
    const generalSection = general.closest("section")
    const lifecycle = screen.getByRole("heading", { name: "Lifecycle" })
    const insightsSection = screen
      .getByRole("heading", { name: "Insights" })
      .closest("section")
    const insights = screen.getByRole("button", { name: "Disable insights" })
    const save = screen.getByRole("button", { name: "Review & save" })

    expect(insightsSection).toContainElement(insights)
    expect(generalSection).not.toContainElement(insights)
    expect(generalSection).not.toContainElement(save)
    expect(insightsSection).not.toContainElement(save)
    expect(general.closest("form")).toContainElement(save)
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

  it("shows the dirty command row and discards the draft", async () => {
    renderSettings()
    expect(
      screen.queryByRole("button", { name: "Discard changes" })
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Checkout rollout" },
    })

    const discard = await screen.findByRole("button", {
      name: "Discard changes",
    })
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
    fireEvent.click(discard)
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Discard changes" })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByLabelText("Name")).toHaveValue("Checkout redesign")
  })

  it("shows the active lifecycle badge and only the archive action", () => {
    renderSettings()
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: "Restore" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Remove permanently" })
    ).not.toBeInTheDocument()
  })

  it("shows restore and permanent removal for an archived flag", () => {
    renderSettings({ ...flag, isArchived: true })
    const restore = screen.getByRole("button", { name: "Restore" })
    const remove = screen.getByRole("button", { name: "Remove permanently" })
    expect(restore).toBeEnabled()
    expect(remove).toBeEnabled()
    expect(restore.parentElement).not.toBe(remove.parentElement)
    expect(screen.getByText("Restore feature flag")).toBeVisible()
    expect(screen.getByText("Remove feature flag permanently")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Review & save" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Archive" })
    ).not.toBeInTheDocument()
  })

  it("saves General changes with one combined request", async () => {
    vi.mocked(updateFeatureFlagGeneral).mockResolvedValue("revision-2")
    const { onSaved } = renderSettings()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Checkout rollout" },
    })
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Updated description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Remove tag checkout" }))
    fireEvent.click(screen.getByRole("button", { name: "Review & save" }))
    fireEvent.click(await screen.findByRole("button", { name: "Save changes" }))

    await waitFor(() =>
      expect(updateFeatureFlagGeneral).toHaveBeenCalledWith(
        "env-1",
        "checkout-redesign",
        {
          name: "Checkout rollout",
          description: "Updated description",
          tags: [],
        },
        ""
      )
    )
    expect(onSaved).toHaveBeenCalledWith({
      ...flag,
      name: "Checkout rollout",
      description: "Updated description",
      tags: [],
      revision: "revision-2",
    })
  })

  it("preserves an unchanged stored name with trailing whitespace", async () => {
    vi.mocked(updateFeatureFlagGeneral).mockResolvedValue("revision-2")
    const storedFlag = {
      ...flag,
      name: "Checkout redesign ",
      description: "Original description",
    }
    renderSettings(storedFlag, {
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
    const flagName = within(dialog).getByText("Checkout redesign")
    expect(flagName.tagName).toBe("STRONG")
    expect(flagName).toHaveClass("font-semibold", "text-foreground")
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" })
    )

    await waitFor(() =>
      expect(updateFeatureFlagGeneral).toHaveBeenCalledWith(
        "env-1",
        "checkout-redesign",
        {
          name: "Checkout redesign ",
          description: "Updated description",
          tags: ["checkout"],
        },
        ""
      )
    )
  })

  it("shows a permission error when the General update returns 403", async () => {
    vi.mocked(updateFeatureFlagGeneral).mockRejectedValue(
      new ApiRequestError(403, "Forbidden")
    )
    const { onSaved } = renderSettings()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Checkout rollout" },
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

  it("shows linked experiment links and blocks disabling insights", async () => {
    vi.mocked(fetchRunningExperiments).mockResolvedValue([
      { id: "expt-1", name: "Checkout conversion" },
    ])
    renderSettings()
    expect(
      await screen.findByRole("link", { name: "Checkout conversion" })
    ).toHaveAttribute("href", "/en/experiments/expt-1")
    expect(
      screen.getByRole("button", { name: "Disable insights" })
    ).toBeDisabled()
  })
  it("saves insights with its own API and leaves General unchanged", async () => {
    vi.mocked(updateFeatureFlagInsightCollection).mockResolvedValue(
      "revision-insights"
    )
    const { onSaved } = renderSettings()
    await screen.findByText(
      "No running experiments are linked to this flag. You can enable or disable insight collection."
    )
    fireEvent.click(screen.getByRole("button", { name: "Disable insights" }))
    fireEvent.click(await screen.findByRole("button", { name: "Disable collection" }))
    await waitFor(() =>
      expect(updateFeatureFlagInsightCollection).toHaveBeenCalledWith(
        "env-1",
        "checkout-redesign",
        false,
        ""
      )
    )
    expect(updateFeatureFlagGeneral).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          insightsEnabled: false,
          revision: "revision-insights",
        })
      )
    )
  })
  it("blocks disabling when the experiments query fails", async () => {
    vi.mocked(fetchRunningExperiments).mockRejectedValue(new Error("offline"))
    renderSettings()
    expect(
      await screen.findByText("Running experiments could not be loaded.")
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Disable insights" })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled()
  })
  it("refreshes experiments when a new experiment blocks the update", async () => {
    vi.mocked(updateFeatureFlagInsightCollection).mockRejectedValue(
      new ApiRequestError(422, "Unprocessable Entity", {
        errors: ["BusinessRuleViolation"],
      })
    )
    renderSettings()
    await screen.findByText(
      "No running experiments are linked to this flag. You can enable or disable insight collection."
    )
    fireEvent.click(screen.getByRole("button", { name: "Disable insights" }))
    fireEvent.click(await screen.findByRole("button", { name: "Disable collection" }))
    await waitFor(() =>
      expect(fetchRunningExperiments).toHaveBeenCalledTimes(2)
    )
    expect(toast.error).toHaveBeenCalled()
  })
})
