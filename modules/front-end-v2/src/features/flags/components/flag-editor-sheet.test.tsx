import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchFeatureFlagTags } from "../flags-api"
import type { FeatureFlag } from "../flags-types"
import { FlagEditorSheet } from "./flag-editor-sheet"

vi.mock("../flags-api", () => ({
  fetchFeatureFlagTags: vi.fn(),
}))

const source: FeatureFlag = {
  id: "flag-1",
  name: "Checkout flow",
  key: "checkout-flow",
  description: "",
  tags: ["current"],
  isEnabled: true,
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
  variationType: "boolean",
}

describe("FlagEditorSheet", () => {
  beforeEach(() => {
    vi.mocked(fetchFeatureFlagTags).mockReset()
    vi.mocked(fetchFeatureFlagTags).mockResolvedValue(["current", "release"])
  })

  it("opens the tag picker without closing the clone sheet", async () => {
    const onOpenChange = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
          lang="en"
          open
          source={source}
          saving={false}
          onOpenChange={onOpenChange}
          onValidateKey={vi.fn().mockResolvedValue(false)}
          onCreate={vi.fn()}
          onClone={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(
      screen.getByRole("dialog", { name: "Clone feature flag" })
    ).toBeVisible()

    fireEvent.click(
      screen.getByRole("button", { name: /Search or create tag/ })
    )

    expect(await screen.findByRole("option", { name: "release" })).toBeVisible()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("generates the clone key from the name using the Angular slug rules", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
          lang="en"
          open
          source={source}
          saving={false}
          onOpenChange={vi.fn()}
          onValidateKey={vi.fn().mockResolvedValue(false)}
          onCreate={vi.fn()}
          onClone={vi.fn()}
        />
      </QueryClientProvider>
    )

    const nameInput = screen.getByLabelText(/^Name/)
    const keyInput = screen.getByLabelText(/^Key/)

    fireEvent.change(nameInput, { target: { value: "New Flag_Name.v2!" } })

    expect(keyInput).toHaveValue("new-flag-namev2")
  })

  it("generates the new flag key while the name changes", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
          lang="en"
          open
          source={null}
          saving={false}
          onOpenChange={vi.fn()}
          onValidateKey={vi.fn().mockResolvedValue(false)}
          onCreate={vi.fn()}
          onClone={vi.fn()}
        />
      </QueryClientProvider>
    )

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Release_Flag v2!" },
    })

    expect(screen.getByLabelText(/^Key/)).toHaveValue("release-flag-v2")
  })
})
