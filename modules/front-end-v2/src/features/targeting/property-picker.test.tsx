import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { upsertEndUserProperty } from "@/features/end-users/end-users-api"
import type { SegmentUserProperty } from "@/features/segments/segments-types"
import "@/lib/i18n/i18n"
import { PropertyPicker } from "./property-picker"

vi.mock("@/features/end-users/end-users-api", () => ({
  upsertEndUserProperty: vi.fn(),
}))

window.HTMLElement.prototype.scrollIntoView = vi.fn()

const properties: SegmentUserProperty[] = [
  {
    id: "country",
    name: "country",
    presetValues: [],
    usePresetValuesOnly: false,
    isBuiltIn: false,
    isDigestField: false,
    remark: "",
  },
  {
    id: "plan",
    name: "plan",
    presetValues: [],
    usePresetValuesOnly: false,
    isBuiltIn: false,
    isDigestField: false,
    remark: "",
  },
]

function renderPicker(
  onValueChange = vi.fn(),
  includeSegmentConditions = false
) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <PropertyPicker
        envId="env-1"
        value="keyId"
        properties={properties}
        includeSegmentConditions={includeSegmentConditions}
        disabled={false}
        onValueChange={onValueChange}
      />
    </QueryClientProvider>
  )
  return { client, onValueChange }
}

describe("PropertyPicker", () => {
  beforeEach(() => {
    vi.mocked(upsertEndUserProperty).mockReset()
  })

  it("searches the shared property catalog", async () => {
    const { onValueChange } = renderPicker()

    fireEvent.click(screen.getByRole("combobox", { name: "Select property" }))
    fireEvent.change(
      await screen.findByPlaceholderText("Search or create a property"),
      { target: { value: "TRY" } }
    )

    expect(screen.getByRole("option", { name: "country" })).toBeVisible()
    expect(screen.queryByRole("option", { name: "plan" })).toBeNull()

    fireEvent.click(screen.getByRole("option", { name: "country" }))
    expect(onValueChange).toHaveBeenCalledWith("country")
  })

  it("creates and selects a property missing from the catalog", async () => {
    const created = { ...properties[0], id: "tier", name: "loyaltyTier" }
    vi.mocked(upsertEndUserProperty).mockResolvedValue(created)
    const { client, onValueChange } = renderPicker()

    fireEvent.click(screen.getByRole("combobox", { name: "Select property" }))
    fireEvent.change(
      await screen.findByPlaceholderText("Search or create a property"),
      { target: { value: "loyaltyTier" } }
    )
    fireEvent.click(
      screen.getByRole("option", {
        name: 'Create property "loyaltyTier"',
      })
    )

    await waitFor(() =>
      expect(upsertEndUserProperty).toHaveBeenCalledWith(
        "env-1",
        expect.any(String),
        expect.objectContaining({ name: "loyaltyTier" })
      )
    )
    await waitFor(() =>
      expect(onValueChange).toHaveBeenCalledWith("loyaltyTier")
    )
    expect(
      client.getQueryData<SegmentUserProperty[]>([
        "segment-user-properties",
        "env-1",
      ])
    ).toContainEqual(created)
  })

  it("offers the reserved segment conditions only when enabled", async () => {
    renderPicker(vi.fn(), true)

    fireEvent.click(screen.getByRole("combobox", { name: "Select property" }))

    expect(
      screen.getAllByRole("option").map((option) => option.textContent)
    ).toEqual([
      "User is in segment",
      "User is not in segment",
      "keyId",
      "name",
      "country",
      "plan",
    ])

    fireEvent.change(
      await screen.findByPlaceholderText("Search or create a property"),
      { target: { value: "User is" } }
    )

    expect(
      screen.getByRole("option", { name: "User is in segment" })
    ).toBeVisible()
    expect(
      screen.getByRole("option", { name: "User is not in segment" })
    ).toBeVisible()
  })

  it("does not create reserved segment conditions when disabled", async () => {
    renderPicker()

    fireEvent.click(screen.getByRole("combobox", { name: "Select property" }))
    fireEvent.change(
      await screen.findByPlaceholderText("Search or create a property"),
      { target: { value: "User is in segment" } }
    )

    expect(screen.getByText("No properties found.")).toBeVisible()
    expect(screen.queryByRole("option", { name: /Create property/ })).toBeNull()
  })
})
