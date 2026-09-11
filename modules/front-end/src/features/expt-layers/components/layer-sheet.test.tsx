import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import type { Layer } from "../layers-types"
import { LayerSheet } from "./layer-sheet"

const layer: Layer = {
  id: "layer-id",
  featBitEnvId: "env-id",
  name: "Checkout",
  key: "checkout",
  description: "Checkout experiments",
  assignmentUnitSelector: "user.keyId",
  status: "active",
  createdAt: "2026-08-28T00:00:00Z",
  updatedAt: "2026-08-28T00:00:00Z",
}

function renderSheet(currentLayer: Layer | null, onSubmit = vi.fn()) {
  const result = render(
    <TooltipProvider>
      <LayerSheet
        layer={currentLayer}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    </TooltipProvider>
  )

  return { ...result, onSubmit }
}

describe("LayerSheet key immutability", () => {
  it("allows the key to be entered while creating a layer", () => {
    renderSheet(null)

    expect(screen.getByLabelText("Key *")).not.toHaveAttribute("readonly")
  })

  it("keeps the stored key when editing a layer", async () => {
    const { onSubmit } = renderSheet(layer)
    const keyInput = screen.getByLabelText("Key")
    expect(keyInput).toHaveAttribute("readonly")
    expect(keyInput).toHaveValue("checkout")
    expect(
      screen.getByText(
        "Layer key cannot be changed after creation because experiment runs may reference it."
      )
    ).toBeVisible()

    fireEvent.change(keyInput, { target: { value: "tampered-key" } })
    const form = keyInput.closest("form")
    expect(form).not.toBeNull()
    if (!form) throw new Error("Expected the edit form to be rendered")
    fireEvent.submit(form)

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ key: "checkout" })
      )
    )
  })
})
