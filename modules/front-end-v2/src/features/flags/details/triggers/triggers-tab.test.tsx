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
import {
  createFlagTrigger,
  fetchFlagTriggers,
  removeFlagTrigger,
  resetFlagTriggerUrl,
  updateFlagTriggerStatus,
  type FlagTrigger,
} from "./triggers-api"
import { TriggersTab } from "./triggers-tab"

vi.mock("./triggers-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./triggers-api")>()),
  createFlagTrigger: vi.fn(),
  fetchFlagTriggers: vi.fn(),
  removeFlagTrigger: vi.fn(),
  resetFlagTriggerUrl: vi.fn(),
  updateFlagTriggerStatus: vi.fn(),
}))

const trigger: FlagTrigger = {
  id: "trigger-1",
  targetId: "flag-1",
  type: "feature-flag-general",
  action: "turn-on",
  token: "server-returned-token",
  description: "Enable after deployment",
  isEnabled: true,
  triggeredTimes: 0,
  updatedAt: "2026-07-27T08:00:00.000Z",
}
const writeText = vi.fn()

function renderTriggers(archived = false) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <TriggersTab flagId="flag-1" archived={archived} />
    </QueryClientProvider>
  )
}

describe("TriggersTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    writeText.mockResolvedValue(undefined)
    vi.mocked(fetchFlagTriggers).mockResolvedValue([trigger])
    vi.mocked(createFlagTrigger).mockResolvedValue({
      ...trigger,
      id: "trigger-2",
      token: "new-secret-token",
    })
    vi.mocked(updateFlagTriggerStatus).mockResolvedValue(true)
    vi.mocked(resetFlagTriggerUrl).mockResolvedValue("reset-secret-token")
    vi.mocked(removeFlagTrigger).mockResolvedValue(true)
  })

  it("masks tokens returned by the list endpoint", async () => {
    renderTriggers()

    expect(await screen.findByText("Enable after deployment")).toBeVisible()
    const actionBadge = screen.getByText("Turn ON")
    expect(actionBadge).toHaveClass("justify-center")
    expect(actionBadge).not.toHaveClass("justify-start")
    expect(screen.getByText("Enabled")).toBeVisible()
    expect(screen.getByText(/••••••/)).toBeVisible()
    expect(screen.queryByText(/server-returned-token/)).not.toBeInTheDocument()
    const resetButton = screen.getByRole("button", { name: "Reset URL" })
    const removeButton = screen.getByRole("button", { name: "Remove" })
    expect(resetButton).toBeEnabled()
    expect(resetButton).toHaveClass("hover:bg-muted", "font-medium")
    expect(resetButton.querySelector("svg")).toBeNull()
    expect(removeButton).toBeEnabled()
    expect(removeButton.querySelector("svg")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "More actions" })
    ).not.toBeInTheDocument()
  })

  it("updates only the controlled status after the request succeeds", async () => {
    renderTriggers()
    const status = await screen.findByRole("switch")

    fireEvent.click(status)

    await waitFor(() =>
      expect(updateFlagTriggerStatus).toHaveBeenCalledWith("trigger-1", false)
    )
    await waitFor(() => expect(status).not.toBeChecked())
    expect(screen.getByText("Disabled")).toBeVisible()
  })

  it("uses the standard dialog styling for reset and remove confirmations", async () => {
    renderTriggers()
    await screen.findByText("Enable after deployment")

    fireEvent.click(screen.getByRole("button", { name: "Reset URL" }))
    let dialog = screen.getByRole("dialog", { name: "Reset trigger URL?" })
    expect(dialog).toHaveAttribute("data-slot", "dialog-content")
    expect(dialog).toHaveClass("sm:max-w-md")
    expect(dialog.querySelector('[data-slot="dialog-footer"]')).toHaveClass(
      "border-t-0",
      "bg-transparent"
    )

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    dialog = screen.getByRole("dialog", { name: "Remove trigger?" })
    expect(dialog).toHaveAttribute("data-slot", "dialog-content")
    expect(dialog).toHaveClass("sm:max-w-md")
    expect(dialog.querySelector('[data-slot="dialog-footer"]')).toHaveClass(
      "border-t-0",
      "bg-transparent"
    )
  })

  it("reveals a newly created URL only in the current page session", async () => {
    renderTriggers()
    fireEvent.click(await screen.findByRole("button", { name: "Add trigger" }))
    const createDialog = screen.getByRole("dialog", { name: "Create trigger" })
    expect(createDialog).toHaveClass("sm:max-w-md")
    expect(createDialog.querySelector("form")).toBeInTheDocument()
    expect(
      createDialog.querySelector('[data-slot="dialog-footer"]')
    ).toHaveClass("border-t-0", "bg-transparent")
    expect(screen.getByLabelText("Type")).toHaveTextContent("General")
    const actionSelect = screen.getByLabelText("Action")
    expect(actionSelect).toHaveTextContent("Turn ON")
    fireEvent.click(
      await screen.findByRole("button", { name: "Create trigger" })
    )

    await waitFor(() =>
      expect(createFlagTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "feature-flag-general",
          action: "turn-on",
        })
      )
    )

    const revealedUrl = await screen.findByText(/new-secret-token/)
    expect(revealedUrl).toBeVisible()
    const copyButton = within(revealedUrl.closest("td")!).getByRole("button", {
      name: "Copy URL",
    })
    expect(copyButton).toBeEnabled()
    expect(copyButton).toContainElement(revealedUrl)
    fireEvent.click(revealedUrl)
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("new-secret-token")
      )
    )
    expect(
      screen.getByText(
        "Copy and save this URL now. It will be masked after leaving this page."
      )
    ).toBeVisible()
  })

  it("keeps archived flags read-only", async () => {
    renderTriggers(true)

    expect(await screen.findByText("Enable after deployment")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Add trigger" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "true")
  })
})
