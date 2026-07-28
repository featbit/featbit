import { createEvent, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import type { FeatureFlag } from "../../flags-types"
import { variationMarkerColor } from "../../variation-colors"
import { VariationsTab } from "./variations-tab"

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout",
  key: "checkout",
  tags: [],
  isEnabled: true,
  createdAt: "2026-07-01T10:00:00Z",
  updatedAt: "2026-07-01T10:00:00Z",
  variationType: "string",
  variations: [
    { id: "control", name: "Control", value: "control" },
    { id: "new", name: "New checkout", value: "new" },
  ],
  targetUsers: [],
  rules: [],
  fallthrough: { variations: [] },
}

describe("VariationsTab", () => {
  it("aligns the data type label and badge by their text baselines", () => {
    const { container } = render(
      <TooltipProvider>
        <VariationsTab
          flag={{ ...flag, variationType: "json" }}
          dirty={false}
          saving={false}
          canUpdate
          onChange={vi.fn()}
          onDiscard={vi.fn()}
          onReview={vi.fn()}
        />
      </TooltipProvider>
    )

    const row = container.querySelector("[data-variation-data-type]")
    expect(row).toHaveClass("items-center")
    expect(row?.firstElementChild).toHaveClass("items-baseline")
    expect(screen.getByText("Data type")).toHaveClass("leading-5")
    expect(screen.getByText("JSON")).toBeVisible()
  })

  it("assigns the shared predefined colors by variation order", () => {
    const { container } = render(
      <TooltipProvider>
        <VariationsTab
          flag={flag}
          dirty={false}
          saving={false}
          canUpdate
          onChange={vi.fn()}
          onDiscard={vi.fn()}
          onReview={vi.fn()}
        />
      </TooltipProvider>
    )

    const markers = container.querySelectorAll("[data-variation-color]")
    expect(markers).toHaveLength(2)
    expect(markers[0]).toHaveClass(...variationMarkerColor(0).split(" "))
    expect(markers[1]).toHaveClass(...variationMarkerColor(1).split(" "))
  })

  it("renders Add variation below and outside the table", () => {
    const onChange = vi.fn()
    const { container } = render(
      <TooltipProvider>
        <VariationsTab
          flag={flag}
          dirty={false}
          saving={false}
          canUpdate
          onChange={onChange}
          onDiscard={vi.fn()}
          onReview={vi.fn()}
        />
      </TooltipProvider>
    )

    const table = container.querySelector("[data-variations-table]")
    const addAction = container.querySelector("[data-variation-add-action]")
    expect(table).not.toContainElement(addAction)
    expect(table?.nextElementSibling).toBe(addAction)
    expect(screen.queryByText("2 variations")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add variation" }))
    expect(onChange).toHaveBeenCalledWith([
      ...flag.variations!,
      expect.objectContaining({ name: "", value: "" }),
    ])
  })

  it("dims the source and moves a card preview with the pointer", () => {
    const onChange = vi.fn()
    const { container } = render(
      <TooltipProvider>
        <VariationsTab
          flag={flag}
          dirty
          saving={false}
          canUpdate
          onChange={onChange}
          onDiscard={vi.fn()}
          onReview={vi.fn()}
        />
      </TooltipProvider>
    )
    const values = new Map<string, string>()
    const setDragImage = vi.fn()
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: (type: string) => values.get(type) ?? "",
      setData: (type: string, value: string) => values.set(type, value),
      setDragImage,
    }
    const handle = screen.getByRole("button", { name: "Reorder Control" })

    fireEvent.dragStart(handle, { dataTransfer })
    const source = container.querySelector('[data-variation-id="control"]')
    const preview = document.querySelector<HTMLElement>(
      "[data-variation-drag-preview]"
    )
    expect(source).toHaveClass("opacity-35")
    expect(setDragImage).toHaveBeenCalledOnce()
    expect(preview).toBeInTheDocument()

    const moveEvent = createEvent.drag(handle, { dataTransfer })
    Object.defineProperties(moveEvent, {
      clientX: { value: 120 },
      clientY: { value: 80 },
    })
    fireEvent(handle, moveEvent)
    expect(preview).toHaveStyle({
      transform: "translate3d(120px, 80px, 0)",
    })

    fireEvent.drop(container.querySelector('[data-variation-id="new"]')!, {
      dataTransfer,
    })
    expect(
      document.querySelector("[data-variation-drag-preview]")
    ).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "new" }),
      expect.objectContaining({ id: "control" }),
    ])
  })
})
