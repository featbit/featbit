import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import { ChangeLedger } from "./change-ledger"

describe("ChangeLedger", () => {
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
})
