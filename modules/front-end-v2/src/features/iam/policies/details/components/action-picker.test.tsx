import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { PolicyStatement } from "../permission-model"
import { ActionPicker } from "./action-picker"

const statement: PolicyStatement = {
  id: "statement-1",
  resourceType: "*",
  effect: "allow",
  actions: ["*"],
  resources: ["*"],
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe("ActionPicker", () => {
  it("filters the list to selected actions", () => {
    render(
      <ActionPicker
        statement={statement}
        fineGrainedGranted
        onChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Manage" }))

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument()
    const selectedFilter = screen.getByRole("button", {
      name: "Selected (1)",
    })
    expect(selectedFilter).toBeEnabled()

    fireEvent.click(selectedFilter)

    expect(
      screen.getByRole("option", { name: "All actions" })
    ).toBeInTheDocument()
  })
})
