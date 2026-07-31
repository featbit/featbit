import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import { fetchOrganizationMembers } from "@/features/organization/organization-members-api"
import { TargetingSubmissionDialog } from "./targeting-submission-dialog"

vi.mock("@/features/auth/auth-api", () => ({
  getStoredUserProfile: vi.fn(),
}))
vi.mock("@/features/organization/organization-members-api", () => ({
  fetchOrganizationMembers: vi.fn(),
}))

window.HTMLElement.prototype.scrollIntoView = vi.fn()

function renderDialog(
  mode: "schedule" | "change-request",
  initialReason?: string,
  onModeChange = vi.fn()
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <TargetingSubmissionDialog
          mode={mode}
          lang="en"
          flagName="Checkout redesign"
          changes={[]}
          initialReason={initialReason}
          scheduleGranted
          changeRequestGranted
          saving={false}
          onOpenChange={vi.fn()}
          onModeChange={onModeChange}
          onSubmit={vi.fn()}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

describe("targeting submission dialog", () => {
  beforeEach(() => {
    vi.mocked(getStoredUserProfile).mockReturnValue({ id: "current-user" })
    vi.mocked(fetchOrganizationMembers).mockResolvedValue({
      items: [],
      totalCount: 0,
    })
  })

  it.each(["schedule", "change-request"] as const)(
    "emphasizes the feature flag name in the %s dialog",
    (mode) => {
      renderDialog(mode)

      const flagName = screen.getByText("Checkout redesign")
      expect(flagName.tagName).toBe("STRONG")
      expect(flagName).toHaveClass("font-semibold", "text-foreground")
    }
  )

  it("opens the native date-time picker from the whole input", () => {
    const showPicker = vi.fn()
    Object.defineProperty(window.HTMLInputElement.prototype, "showPicker", {
      configurable: true,
      value: showPicker,
    })
    renderDialog("schedule")

    fireEvent.click(screen.getByLabelText(/Scheduled time/))
    expect(showPicker).toHaveBeenCalledOnce()
  })

  it("disables date-time values earlier than when the dialog opened", () => {
    const openedAt = new Date("2026-07-27T09:42:00.000Z")
    const now = vi.spyOn(Date, "now").mockReturnValue(openedAt.getTime())
    renderDialog("schedule")

    const input = screen.getByLabelText(/Scheduled time/)
    const expectedLocalMinute = new Date(
      openedAt.getTime() - openedAt.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 16)
    expect(input).toHaveAttribute("min", expectedLocalMinute)
    now.mockRestore()
  })

  it("keeps focus rings inside the scrollable dialog body", () => {
    renderDialog("schedule")
    expect(
      document.querySelector('[data-slot="submission-dialog-body"]')
    ).toHaveClass("px-1")
  })

  it("layers the reviewers popover above the dialog", async () => {
    renderDialog("change-request")
    fireEvent.click(screen.getByRole("combobox", { name: "Search reviewers" }))

    expect(
      document.querySelector('[data-slot="reviewer-popover-positioner"]')
    ).toHaveClass("z-[60]")
    expect(await screen.findByText("No reviewers found.")).toBeVisible()
  })

  it("keeps selected reviewer chips inside the multi-select control", async () => {
    vi.mocked(fetchOrganizationMembers).mockResolvedValue({
      items: [
        {
          id: "reviewer-1",
          name: "Emma Wilson",
          email: "emma@example.com",
        },
      ],
      totalCount: 1,
    })
    renderDialog("change-request")
    const picker = screen.getByRole("combobox", { name: "Search reviewers" })
    fireEvent.click(picker)
    fireEvent.click(await screen.findByRole("option", { name: /Emma Wilson/ }))

    expect(within(picker).getByText("Emma Wilson")).toBeVisible()
    expect(
      within(picker).getByRole("button", { name: "Remove Emma Wilson" })
    ).toBeVisible()
    expect(picker).toHaveClass("flex-wrap", "max-h-24")

    if (picker.getAttribute("aria-expanded") === "true") {
      fireEvent.click(picker)
    }
    const reviewerName = within(picker).getByText("Emma Wilson")
    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(reviewerName)
    expect(await screen.findByText("emma@example.com")).toBeVisible()
  })

  it("carries the review comment into the selected submission flow", () => {
    renderDialog("schedule", "Coordinate with support")

    expect(screen.getByLabelText(/Reason/)).toHaveValue(
      "Coordinate with support"
    )
  })

  it("keeps save options available from a submission flow", async () => {
    const onModeChange = vi.fn()
    renderDialog("schedule", "Coordinate with support", onModeChange)

    fireEvent.click(screen.getByRole("button", { name: "More save options" }))
    expect(await screen.findByText("Request approval")).toBeVisible()
    expect(screen.getByText("Apply immediately")).toBeVisible()

    fireEvent.click(screen.getByText("Request approval"))
    expect(onModeChange).toHaveBeenCalledWith(
      "change-request",
      "Coordinate with support"
    )

    fireEvent.click(screen.getByRole("button", { name: "More save options" }))
    fireEvent.click(await screen.findByText("Save changes"))
    expect(onModeChange).toHaveBeenCalledWith("save", "Coordinate with support")
  })
})
import "@/lib/i18n/i18n"
