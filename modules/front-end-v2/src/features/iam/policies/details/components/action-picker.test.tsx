import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { PolicyStatement } from "../permission-model"
import { ActionPicker } from "./action-picker"

const statement: PolicyStatement = {
  id: "statement-1",
  resourceType: "flag",
  effect: "allow",
  actions: ["CreateFlag"],
  resources: ["project/*:env/*:flag/*"],
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

    expect(
      screen.getByRole("button", { name: "Specific actions" })
    ).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Manage" }))

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument()
    const selectedFilter = screen.getByRole("button", {
      name: "Selected (1)",
    })
    expect(selectedFilter).toBeEnabled()

    fireEvent.click(selectedFilter)

    expect(
      screen.getByRole("option", { name: /Create flags.*CreateFlag/ })
    ).toBeInTheDocument()
    expect(screen.getByText("CreateFlag")).toHaveClass("font-mono")
    expect(
      screen.queryByRole("option", { name: "All actions" })
    ).not.toBeInTheDocument()
  })

  it("switches between all and specific action modes", () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ActionPicker
        statement={statement}
        fineGrainedGranted
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "All actions" }))
    expect(onChange).toHaveBeenLastCalledWith(["*"])

    rerender(
      <ActionPicker
        statement={{ ...statement, actions: ["*"] }}
        fineGrainedGranted
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Specific actions" }))
    expect(onChange).toHaveBeenLastCalledWith([])

    rerender(
      <ActionPicker
        statement={{ ...statement, actions: [] }}
        fineGrainedGranted
        onChange={onChange}
      />
    )
    expect(
      screen.queryByPlaceholderText("Search actions...")
    ).not.toBeInTheDocument()
  })

  it("only offers all actions when the resource type has no specific actions", () => {
    render(
      <ActionPicker
        statement={{
          ...statement,
          resourceType: "*",
          actions: ["*"],
          resources: ["*"],
        }}
        fineGrainedGranted
        onChange={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "All actions" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(
      screen.queryByRole("button", { name: "Specific actions" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Manage" })
    ).not.toBeInTheDocument()
  })

  it.each(["flag", "segment"] as const)(
    "only offers all actions for an unlicensed %s resource",
    (resourceType) => {
      render(
        <ActionPicker
          statement={{
            ...statement,
            resourceType,
            actions: ["*"],
            resources: [
              resourceType === "flag"
                ? "project/*:env/*:flag/*"
                : "project/*:env/*:segment/*",
            ],
          }}
          fineGrainedGranted={false}
          onChange={vi.fn()}
        />
      )

      expect(
        screen.getByRole("button", { name: "All actions" })
      ).toHaveAttribute("aria-pressed", "true")
      expect(
        screen.queryByRole("button", { name: "Specific actions" })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Manage" })
      ).not.toBeInTheDocument()
    }
  )
})
