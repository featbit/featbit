import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import type { Layer } from "../layers-types"
import { LayerSheet } from "./layer-sheet"

const layer: Layer = {
  id: "layer-id",
  envId: "env-id",
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
  it("regenerates the key when the name changes after a manual key edit", async () => {
    renderSheet(null)

    const nameInput = screen.getByLabelText("Name *")
    const keyInput = screen.getByLabelText("Key *")
    expect(keyInput).not.toHaveAttribute("readonly")

    fireEvent.change(nameInput, { target: { value: "Checkout__Flow.v2:!" } })
    await waitFor(() => expect(keyInput).toHaveValue("checkout-flowv2"))

    fireEvent.change(keyInput, {
      target: { value: "checkout_custom.v2:layer" },
    })
    await waitFor(() =>
      expect(keyInput).toHaveValue("checkout_custom.v2:layer")
    )

    fireEvent.change(nameInput, { target: { value: "Updated checkout" } })
    await waitFor(() => expect(keyInput).toHaveValue("updated-checkout"))

    fireEvent.change(nameInput, { target: { value: "" } })
    await waitFor(() => expect(keyInput).toHaveValue(""))
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

    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: "Updated checkout" },
    })
    await waitFor(() => expect(keyInput).toHaveValue("checkout"))

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
