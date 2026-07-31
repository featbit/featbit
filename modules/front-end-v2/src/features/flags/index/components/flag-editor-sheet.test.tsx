import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { fetchFeatureFlagTags } from "../../flags-api"
import type { FeatureFlag } from "../../flags-types"
import { FlagEditorSheet } from "./flag-editor-sheet"

vi.mock("../../flags-api", () => ({
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

  it("overrides the shared right-sheet width for the feature flag editor", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
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

    const sheet = screen.getByRole("dialog", { name: "New feature flag" })
    expect(sheet).toHaveClass("data-[side=right]:sm:max-w-xl")
    expect(sheet).not.toHaveClass("data-[side=right]:sm:max-w-sm")
  })

  it("lets boolean values fill the remaining variation row", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
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

    const booleanValueRow =
      screen.getByDisplayValue("true").parentElement?.parentElement

    expect(booleanValueRow).toHaveClass(
      "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    )
    expect(booleanValueRow).not.toHaveClass(
      "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem]"
    )
  })

  it("shows the selected variation type in uppercase with a wider trigger", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
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

    const typeSelect = screen.getAllByRole("combobox")[0]
    expect(typeSelect).toHaveTextContent("BOOLEAN")
    expect(typeSelect).toHaveClass("w-full", "sm:max-w-[280px]")
  })

  it("uses the tag picker when creating a feature flag", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
          open
          source={null}
          saving={false}
          onOpenChange={vi.fn()}
          onValidateKey={vi.fn().mockResolvedValue(false)}
          onCreate={onCreate}
          onClone={vi.fn()}
        />
      </QueryClientProvider>
    )

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Release flag" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: /Search or create tag/ })
    )
    fireEvent.click(await screen.findByRole("option", { name: "release" }))
    fireEvent.click(screen.getByRole("button", { name: "Create flag" }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["release"] })
      )
    )
  })

  it("edits and submits a string variation collection", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
          open
          source={null}
          saving={false}
          onOpenChange={vi.fn()}
          onValidateKey={vi.fn().mockResolvedValue(false)}
          onCreate={onCreate}
          onClone={vi.fn()}
        />
      </QueryClientProvider>
    )

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Homepage message" },
    })
    fireEvent.click(screen.getAllByRole("combobox")[0])
    const stringOption = await screen.findByRole("option", { name: "STRING" })
    fireEvent.pointerDown(stringOption, { pointerType: "mouse" })
    fireEvent.click(stringOption)

    const nameInputs = screen.getAllByPlaceholderText("Name")
    const valueInputs = screen.getAllByPlaceholderText("Value")
    fireEvent.change(nameInputs[0], { target: { value: "Control" } })
    fireEvent.change(valueInputs[0], { target: { value: "Welcome" } })
    fireEvent.click(screen.getByRole("button", { name: "Add variation" }))
    fireEvent.change(screen.getAllByPlaceholderText("Name")[2], {
      target: { value: "Experiment" },
    })
    fireEvent.change(screen.getAllByPlaceholderText("Value")[2], {
      target: { value: "Try the new flow" },
    })
    const serveWhenOn = screen.getAllByRole("combobox")[1]
    fireEvent.click(serveWhenOn)
    const experimentOption = await screen.findByRole("option", {
      name: "Experiment",
    })
    fireEvent.pointerDown(experimentOption, { pointerType: "mouse" })
    fireEvent.click(experimentOption)
    expect(serveWhenOn).toHaveTextContent("Experiment")
    fireEvent.click(screen.getByRole("button", { name: "Create flag" }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce())
    const payload = onCreate.mock.calls[0][0]
    expect(payload.variationType).toBe("string")
    expect(payload.variations).toEqual([
      expect.objectContaining({ name: "Control", value: "Welcome" }),
      expect.objectContaining({
        name: "Variation B",
        value: "variation-b",
      }),
      expect.objectContaining({
        name: "Experiment",
        value: "Try the new flow",
      }),
    ])
    expect(payload.enabledVariationId).toBe(payload.variations[2].id)
    expect(payload.disabledVariationId).toBe(payload.variations[1].id)
  })

  it("asks before replacing customized variations", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
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

    fireEvent.change(screen.getAllByPlaceholderText("Name")[0], {
      target: { value: "Custom true" },
    })
    const typeSelect = screen.getAllByRole("combobox")[0]
    fireEvent.click(typeSelect)
    const stringOption = await screen.findByRole("option", { name: "STRING" })
    fireEvent.pointerDown(stringOption, { pointerType: "mouse" })
    fireEvent.click(stringOption)

    expect(
      await screen.findByRole("dialog", { name: "Change variation type?" })
    ).toBeVisible()
    expect(typeSelect).toHaveTextContent(/boolean/i)
    expect(screen.getByDisplayValue("Custom true")).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Change type" }))

    expect(typeSelect).toHaveTextContent(/string/i)
    expect(screen.getByDisplayValue("Variation A")).toBeVisible()
  })

  it("confirms before deleting a variation used by the default rule", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
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

    fireEvent.click(screen.getAllByRole("combobox")[0])
    const stringOption = await screen.findByRole("option", { name: "STRING" })
    fireEvent.pointerDown(stringOption, { pointerType: "mouse" })
    fireEvent.click(stringOption)
    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete variation" })[0]
    )

    expect(
      await screen.findByRole("dialog", { name: "Delete variation?" })
    ).toBeVisible()
    expect(
      screen.getByText(/is used by Serve when on.*Variation B/)
    ).toBeVisible()
    expect(screen.getByDisplayValue("Variation A")).toBeVisible()

    fireEvent.click(
      screen.getByRole("button", { name: "Delete and update rules" })
    )

    expect(screen.queryByDisplayValue("Variation A")).not.toBeInTheDocument()
    expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("Variation B")
    expect(screen.getAllByRole("combobox")[2]).toHaveTextContent("Variation B")
  })

  it("opens JSON values in the CodeMirror editor", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
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
      target: { value: "JSON flag" },
    })
    fireEvent.click(screen.getAllByRole("combobox")[0])
    const jsonOption = await screen.findByRole("option", { name: "JSON" })
    fireEvent.pointerDown(jsonOption, { pointerType: "mouse" })
    fireEvent.click(jsonOption)

    const editButtons = screen.getAllByRole("button", {
      name: /Edit JSON for/,
    })
    expect(editButtons).toHaveLength(2)
    expect(editButtons[0]).toHaveClass("h-10")
    expect(editButtons[0]).not.toHaveClass("min-h-16")
    fireEvent.click(editButtons[0])

    expect(
      await screen.findByRole("dialog", { name: "Edit JSON value" })
    ).toBeVisible()
    expect(screen.getByTestId("flag-json-code-editor")).toContainElement(
      document.querySelector(".cm-editor")
    )
    expect(screen.getByText("Valid JSON object or array")).toBeVisible()
  })

  it("disables the complete form while saving", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
          open
          source={null}
          saving
          onOpenChange={vi.fn()}
          onValidateKey={vi.fn().mockResolvedValue(false)}
          onCreate={vi.fn()}
          onClone={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText(/^Name/)).toBeDisabled()
    expect(screen.getByLabelText(/^Key/)).toBeDisabled()
    expect(screen.getByLabelText("Description")).toBeDisabled()
    expect(screen.getAllByPlaceholderText("Name")[0]).toBeDisabled()
    expect(
      screen.getByRole("button", { name: /Search or create tag/ })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Create flag" })).toBeDisabled()
  })

  it("confirms before closing a dirty sheet", async () => {
    const onOpenChange = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlagEditorSheet
          envId="env-1"
          open
          source={null}
          saving={false}
          onOpenChange={onOpenChange}
          onValidateKey={vi.fn().mockResolvedValue(false)}
          onCreate={vi.fn()}
          onClone={vi.fn()}
        />
      </QueryClientProvider>
    )

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Unsaved flag" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(
      await screen.findByRole("dialog", { name: "Discard changes?" })
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
