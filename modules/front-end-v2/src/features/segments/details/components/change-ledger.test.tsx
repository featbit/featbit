import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import { ChangeLedger } from "./change-ledger"

describe("ChangeLedger", () => {
  it("shows affected user counts for targeting collections", async () => {
    await i18n.changeLanguage("en")
    render(
      <ChangeLedger
        layout="targeting"
        changes={[
          {
            kind: "users",
            label: "includedUsers",
            action: "added",
            affectedCount: 3,
            values: ["user-1", "user-2", "user-3"],
          },
          {
            kind: "users",
            label: "excludedUsers",
            action: "removed",
            affectedCount: 1,
            values: ["user-4"],
          },
        ]}
      />
    )

    expect(screen.getByText("Added · 3")).toBeVisible()
    expect(screen.getByText("Removed · 1")).toBeVisible()
  })

  it("shows tag additions and removals without a redundant Updated action", async () => {
    await i18n.changeLanguage("en")

    render(
      <ChangeLedger
        layout="settings"
        changes={[
          {
            kind: "tags",
            label: "tags",
            valueGroups: [
              { action: "added", values: ["tag9"] },
              { action: "removed", values: ["tag3"] },
            ],
          },
        ]}
      />
    )

    expect(screen.getByText("Tags")).toBeVisible()
    expect(screen.getByText("Added · 1")).toBeVisible()
    expect(screen.getByText("Removed · 1")).toBeVisible()
    expect(screen.getByText("tag9")).toBeVisible()
    expect(screen.getByText("tag3")).toBeVisible()
    expect(screen.queryByText("Updated")).not.toBeInTheDocument()
  })

  it("keeps settings, targeting, and history column widths independent", async () => {
    await i18n.changeLanguage("en")
    const change = {
      kind: "field" as const,
      label: "name",
      action: "updated" as const,
      previous: "Old name",
      current: "New name",
    }
    const { container, rerender } = render(
      <ChangeLedger layout="settings" changes={[change]} />
    )

    expect(container.firstElementChild?.firstElementChild).toHaveClass(
      "grid-cols-[6.875rem_5.625rem_minmax(0,1fr)]"
    )

    rerender(<ChangeLedger layout="targeting" changes={[change]} />)
    expect(container.firstElementChild?.firstElementChild).toHaveClass(
      "grid-cols-[minmax(10.625rem,11.875rem)_6rem_minmax(0,1fr)]"
    )

    rerender(<ChangeLedger layout="history" changes={[change]} />)
    expect(container.firstElementChild?.firstElementChild).toHaveClass(
      "grid-cols-[minmax(11.25rem,13.75rem)_6.25rem_minmax(0,1fr)]"
    )
  })

  it("separates a rule name change from its changed conditions", async () => {
    await i18n.changeLanguage("en")
    render(
      <ChangeLedger
        layout="targeting"
        changes={[
          {
            kind: "rule",
            label: "Enterprise accounts",
            action: "updated",
            previousRule: {
              id: "rule-1",
              name: "Enterprise customers",
              conditions: [
                {
                  id: "condition-1",
                  property: "plan",
                  op: "Equal",
                  value: "professional",
                },
                {
                  id: "condition-2",
                  property: "region",
                  op: "Equal",
                  value: "US",
                },
              ],
            },
            currentRule: {
              id: "rule-1",
              name: "Enterprise accounts",
              conditions: [
                {
                  id: "condition-1",
                  property: "plan",
                  op: "Equal",
                  value: "enterprise",
                },
                {
                  id: "condition-2",
                  property: "region",
                  op: "Equal",
                  value: "US",
                },
              ],
            },
          },
        ]}
      />
    )

    expect(screen.getByText("Name")).toBeVisible()
    expect(screen.getByText("Conditions")).toBeVisible()
    expect(screen.getByText("Enterprise customers")).toBeVisible()
    expect(screen.getAllByText("equals")).toSatisfy((items: HTMLElement[]) =>
      items.every((item) => item.classList.contains("font-mono"))
    )
    expect(screen.getAllByText("plan")).toSatisfy((items: HTMLElement[]) =>
      items.every((item) => !item.classList.contains("font-mono"))
    )
    expect(screen.getByText("professional")).not.toHaveClass("font-mono")
    expect(screen.getByText("enterprise")).not.toHaveClass("font-mono")
    expect(screen.queryByText("region")).not.toBeInTheDocument()
    expect(screen.queryByText("US")).not.toBeInTheDocument()
  })
})
