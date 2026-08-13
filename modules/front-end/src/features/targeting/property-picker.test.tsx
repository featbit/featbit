import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { upsertEndUserProperty } from "@/features/end-users/end-users-api"
import type { EndUserProperty } from "@/features/end-users/end-users-types"
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

  it("creates, selects, and appends a property to existing caches", async () => {
    const created = { ...properties[0], id: "tier", name: "loyaltyTier" }
    vi.mocked(upsertEndUserProperty).mockResolvedValue(created)
    const { client, onValueChange } = renderPicker()
    const cacheKeys = [
      ["flag-user-properties", "env-1"],
      ["segment-user-properties", "env-1"],
      ["end-users", "env-1", "properties"],
    ] as const
    cacheKeys.forEach((cacheKey) => client.setQueryData(cacheKey, properties))

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
    cacheKeys
      .slice(0, 2)
      .forEach((cacheKey) =>
        expect(
          client.getQueryData<SegmentUserProperty[]>(cacheKey)
        ).toContainEqual(created)
      )
    expect(client.getQueryData<EndUserProperty[]>(cacheKeys[2])).toContainEqual(
      created
    )
  })

  it("does not seed property caches that have not been fetched", async () => {
    const created = { ...properties[0], id: "tier", name: "loyaltyTier" }
    vi.mocked(upsertEndUserProperty).mockResolvedValue(created)
    const { client, onValueChange } = renderPicker()
    const invalidateQueries = vi.spyOn(client, "invalidateQueries")

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
      expect(onValueChange).toHaveBeenCalledWith("loyaltyTier")
    )
    expect(invalidateQueries).toHaveBeenCalledTimes(3)
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["flag-user-properties", "env-1"],
      exact: true,
    })
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["segment-user-properties", "env-1"],
      exact: true,
    })
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ["end-users", "env-1", "properties"],
      exact: true,
    })
    expect(
      client.getQueryData(["flag-user-properties", "env-1"])
    ).toBeUndefined()
    expect(
      client.getQueryData(["segment-user-properties", "env-1"])
    ).toBeUndefined()
    expect(
      client.getQueryData(["end-users", "env-1", "properties"])
    ).toBeUndefined()
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
