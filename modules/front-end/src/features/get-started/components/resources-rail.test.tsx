import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import { ResourcesRail } from "./resources-rail"

describe("ResourcesRail", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en")
    window.env = {}
  })

  it("shows why the interactive demo is unavailable without relying on a tooltip", () => {
    render(<ResourcesRail />)

    expect(
      screen.queryByRole("link", { name: "Try the interactive demo" })
    ).toBeNull()
    expect(screen.getByText("Try the interactive demo")).not.toHaveAttribute(
      "title"
    )
    expect(
      screen.getByText(
        i18n.t("getStarted.resources.interactiveDemoUnavailable")
      )
    ).toBeVisible()
  })

  it("uses grouped columns below the wide rail breakpoint and becomes sticky beside the task", () => {
    render(<ResourcesRail />)

    expect(screen.getByRole("complementary")).toHaveClass(
      "p-4",
      "@min-[70rem]:sticky",
      "@min-[70rem]:top-5"
    )

    const groups = screen.getByRole("heading", { name: "Quick demo" })
      .parentElement?.parentElement
    expect(groups).toHaveClass(
      "grid",
      "@min-[48rem]:grid-cols-2",
      "@min-[64rem]:grid-cols-3",
      "@min-[70rem]:block"
    )
  })
})
