import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SummaryRow } from "./summary-row"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "workspace.license.forever" ? "Forever" : key,
  }),
}))

describe("SummaryRow expiration", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it.each([
    { days: 367, date: "Jan 03, 2027" },
    { days: 1825, date: "Dec 31, 2030" },
  ])("shows the expiration date with $days days remaining", ({ days, date }) => {
    render(
      <SummaryRow
        license={{ exp: Date.now() + days * 86_400_000 }}
        status="active"
        lang="en"
      />
    )

    expect(screen.getByText(date)).toBeVisible()
    expect(screen.queryByText("Forever")).not.toBeInTheDocument()
  })

  it("shows Forever with 1826 days remaining", () => {
    render(
      <SummaryRow
        license={{ exp: Date.now() + 1826 * 86_400_000 }}
        status="active"
        lang="en"
      />
    )

    expect(screen.getByText("Forever")).toBeVisible()
    expect(screen.queryByText("Jan 01, 2031")).not.toBeInTheDocument()
  })

  it("shows Forever for a 99-year SaaS license", () => {
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 99)

    render(
      <SummaryRow
        license={{ iat: Date.now(), exp: expiresAt.getTime() }}
        status="active"
        lang="en"
      />
    )

    expect(screen.getByText("Forever")).toBeVisible()
    expect(screen.queryByText("Jan 01, 2125")).not.toBeInTheDocument()
  })
})
