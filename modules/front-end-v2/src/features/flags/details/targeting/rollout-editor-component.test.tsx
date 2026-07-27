import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PercentageRolloutEditor } from "./rollout-editor"

window.HTMLElement.prototype.scrollIntoView = vi.fn()

describe("percentage rollout editor", () => {
  it("offers built-in and custom user properties as dispatch keys", async () => {
    render(
      <TooltipProvider>
        <PercentageRolloutEditor
          variations={[
            { id: "a", name: "Variation A", value: "a" },
            { id: "b", name: "Variation B", value: "b" },
          ]}
          value={[
            { id: "a", rollout: [0, 0.5] },
            { id: "b", rollout: [0.5, 1] },
          ]}
          dispatchKey="plan"
          properties={[
            {
              id: "key-id",
              name: "keyId",
              presetValues: [],
              usePresetValuesOnly: false,
              isBuiltIn: true,
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
            {
              id: "region",
              name: "region",
              presetValues: [],
              usePresetValuesOnly: false,
              isBuiltIn: false,
              isDigestField: false,
              remark: "",
            },
          ]}
          onCancel={vi.fn()}
          onApply={vi.fn()}
        />
      </TooltipProvider>
    )

    const trigger = screen.getByRole("combobox", {
      name: "Dispatch by property",
    })
    expect(trigger).toHaveTextContent("plan")
    fireEvent.click(trigger)

    expect(await screen.findByRole("option", { name: "keyId" })).toBeVisible()
    expect(screen.getByRole("option", { name: "name" })).toBeVisible()
    expect(screen.getByRole("option", { name: "plan" })).toBeVisible()
    expect(screen.getByRole("option", { name: "region" })).toBeVisible()
    expect(screen.getAllByRole("option")).toHaveLength(4)
  })
})
