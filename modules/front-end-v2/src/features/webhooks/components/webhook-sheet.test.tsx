import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { DEFAULT_PAYLOAD_TEMPLATE } from "../webhook-events"
import type { Webhook } from "../webhook-types"
import type { DebugConfiguration } from "./live-debug-dialog"
import { WebhookSheet } from "./webhook-sheet"

vi.mock("./code-mirror-template-editor", () => ({
  CodeMirrorTemplateEditor: () => <div>Template editor</div>,
}))

const webhook: Webhook = {
  id: "webhook-1",
  name: "Production webhook",
  scopes: ["project/shop:env/production"],
  scopeNames: ["Production"],
  url: "https://example.com/webhook",
  secret: "",
  events: ["feature_flag.created"],
  headers: [],
  payloadTemplateType: "default",
  payloadTemplate: DEFAULT_PAYLOAD_TEMPLATE,
  isActive: true,
  preventEmptyPayloads: false,
  creator: { name: "Test user" },
}

function renderWithQueryClient(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
  )
}

function renderSheet({
  liveDebugOpen = false,
  onOpenChange = vi.fn<(open: boolean) => void>(),
  onDebug = vi.fn<(configuration: DebugConfiguration) => void>(),
}: {
  liveDebugOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onDebug?: (configuration: DebugConfiguration) => void
} = {}) {
  return renderWithQueryClient(
    <WebhookSheet
      open
      mode="view"
      webhook={webhook}
      projects={[]}
      environments={[]}
      environmentsLoading={false}
      environmentsError={false}
      isSaving={false}
      liveDebugOpen={liveDebugOpen}
      onOpenChange={onOpenChange}
      onModeChange={vi.fn()}
      onRetryEnvironments={vi.fn()}
      onDebug={onDebug}
      onSubmit={vi.fn()}
    />
  )
}

function clickSheetBackdrop() {
  const backdrop = document.querySelector('[data-slot="sheet-overlay"]')
  expect(backdrop).not.toBeNull()
  fireEvent.pointerDown(backdrop!)
  fireEvent.click(backdrop!)
}

describe("WebhookSheet", () => {
  it("closes when the backdrop is clicked", () => {
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })

    clickSheetBackdrop()

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("keeps the sheet open while Live Debug is open", () => {
    const onOpenChange = vi.fn()
    renderSheet({ liveDebugOpen: true, onOpenChange })

    clickSheetBackdrop()

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("opens Live Debug without closing the sheet", () => {
    const onOpenChange = vi.fn()
    const onDebug = vi.fn()
    renderSheet({ onOpenChange, onDebug })

    fireEvent.click(screen.getByRole("button", { name: "Live debug" }))

    expect(onDebug).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
