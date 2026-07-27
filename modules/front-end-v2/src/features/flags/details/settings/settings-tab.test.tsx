import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { FeatureFlag } from "../../flags-types"
import { SettingsTab } from "./settings-tab"

vi.mock("../../flags-api", () => ({
  archiveFeatureFlag: vi.fn(),
  removeFeatureFlag: vi.fn(),
  restoreFeatureFlag: vi.fn(),
  updateFeatureFlagDescription: vi.fn(),
  updateFeatureFlagName: vi.fn(),
  updateFeatureFlagTags: vi.fn(),
  fetchFeatureFlagTags: vi.fn().mockResolvedValue([]),
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

function renderSettings(value: FeatureFlag = flag) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsTab
        envId="env-1"
        flag={value}
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

describe("SettingsTab", () => {
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
})
