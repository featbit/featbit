import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
    expect(screen.getByText(/••••••/)).toBeVisible()
    expect(screen.queryByText(/server-returned-token/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reset URL" })).toBeEnabled()
  })

  it("updates only the controlled status after the request succeeds", async () => {
    renderTriggers()
    const status = await screen.findByRole("switch")

    fireEvent.click(status)

    await waitFor(() =>
      expect(updateFlagTriggerStatus).toHaveBeenCalledWith("trigger-1", false)
    )
    await waitFor(() => expect(status).not.toBeChecked())
  })

  it("reveals a newly created URL only in the current page session", async () => {
    renderTriggers()
    fireEvent.click(await screen.findByRole("button", { name: "Add trigger" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Create trigger" })
    )

    expect(await screen.findByText(/new-secret-token/)).toBeVisible()
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
