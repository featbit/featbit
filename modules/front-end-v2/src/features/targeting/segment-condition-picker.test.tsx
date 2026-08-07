import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchSegments,
  fetchSegmentsByIds,
} from "@/features/segments/segments-api"
import type { Segment } from "@/features/segments/segments-types"
import "@/lib/i18n/i18n"
import { SegmentConditionPicker } from "./segment-condition-picker"

vi.mock("@/features/segments/segments-api", () => ({
  fetchSegments: vi.fn(),
  fetchSegmentsByIds: vi.fn(),
}))

window.HTMLElement.prototype.scrollIntoView = vi.fn()

function segment(id: string, name: string): Segment {
  return {
    id,
    name,
    key: name.toLocaleLowerCase().replaceAll(" ", "-"),
    type: "environment-specific",
    scopes: [],
    tags: [],
    description: "",
    updatedAt: "2026-08-07T00:00:00Z",
    isArchived: false,
    included: [],
    excluded: [],
    rules: [],
  }
}

function renderPicker(initialValue = "[]") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Harness() {
    const [value, setValue] = useState(initialValue)
    return (
      <>
        <SegmentConditionPicker
          envId="env-1"
          value={value}
          disabled={false}
          onValueChange={setValue}
        />
        <output>{value}</output>
      </>
    )
  }

  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  )
}

describe("SegmentConditionPicker", () => {
  beforeEach(() => {
    vi.mocked(fetchSegments).mockReset()
    vi.mocked(fetchSegmentsByIds).mockReset()
    vi.mocked(fetchSegments).mockResolvedValue({
      items: [segment("segment-a", "Alpha users")],
      totalCount: 1,
    })
    vi.mocked(fetchSegmentsByIds).mockImplementation(async (_, ids) =>
      ids.map((id) => segment(id, id === "segment-a" ? "Alpha users" : id))
    )
  })

  it("searches and serializes selected segment ids", async () => {
    renderPicker()

    fireEvent.click(screen.getByRole("combobox", { name: "Select segments" }))
    fireEvent.change(await screen.findByPlaceholderText("Search segments"), {
      target: { value: "Alpha" },
    })

    await waitFor(() =>
      expect(fetchSegments).toHaveBeenLastCalledWith("env-1", {
        name: "Alpha",
        isArchived: false,
        pageIndex: 0,
        pageSize: 20,
      })
    )
    fireEvent.click(await screen.findByRole("option", { name: /Alpha users/ }))

    expect(screen.getByText('["segment-a"]')).toBeVisible()
    await waitFor(() =>
      expect(fetchSegmentsByIds).toHaveBeenCalledWith("env-1", ["segment-a"])
    )
  })

  it("keeps the search result order after selecting a segment", async () => {
    vi.mocked(fetchSegments).mockResolvedValue({
      items: [
        segment("segment-a", "Alpha users"),
        segment("segment-b", "Beta users"),
        segment("segment-c", "Customer users"),
      ],
      totalCount: 3,
    })

    renderPicker()

    const trigger = screen.getByRole("combobox", { name: "Select segments" })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).toHaveClass("hover:bg-transparent")
    expect(trigger).toHaveClass("aria-expanded:bg-transparent")
    expect(trigger).not.toHaveClass("hover:bg-muted")
    const options = await screen.findAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "Alpha usersalpha-users",
      "Beta usersbeta-users",
      "Customer userscustomer-users",
    ])

    fireEvent.click(options[1])

    await waitFor(() =>
      expect(fetchSegmentsByIds).toHaveBeenCalledWith("env-1", ["segment-b"])
    )
    expect(
      screen.getAllByRole("option").map((option) => option.textContent)
    ).toEqual([
      "Alpha usersalpha-users",
      "Beta usersbeta-users",
      "Customer userscustomer-users",
    ])
  })

  it("shows every selected segment as a removable token", async () => {
    renderPicker(
      JSON.stringify(["segment-a", "segment-b", "segment-c", "segment-d"])
    )

    await waitFor(() =>
      expect(fetchSegmentsByIds).toHaveBeenCalledWith("env-1", [
        "segment-a",
        "segment-b",
        "segment-c",
        "segment-d",
      ])
    )

    const field = screen.getByTestId("segment-condition-picker")
    await waitFor(() =>
      expect(field).toHaveTextContent("Alpha userssegment-bsegment-csegment-d")
    )
    expect(field.querySelectorAll('[data-slot="badge"]')).toHaveLength(4)
    expect(field).not.toHaveTextContent("+2")

    fireEvent.click(screen.getByRole("button", { name: "Remove segment-b" }))

    expect(
      screen.getByText('["segment-a","segment-c","segment-d"]')
    ).toBeVisible()
    expect(
      screen.getByRole("combobox", { name: "Select segments" })
    ).toHaveAttribute("aria-expanded", "false")
  })
})
