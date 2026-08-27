import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import {
  ExperimentsPage,
  LayersPage,
  MetricsPage,
} from "./release-decision-pages"

describe("release decision coming-soon pages", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en")
  })

  it("renders the v1 Experiments content", async () => {
    await i18n.changeLanguage("en")
    render(<ExperimentsPage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Experiments" })
    ).toBeInTheDocument()
    expect(screen.getByText("In development")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Experiments are coming soon",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "We’re building a focused workflow for running experiments and understanding their impact. It’ll be available here soon."
      )
    ).toBeInTheDocument()
  })

  it("renders the v1 Metrics content", async () => {
    await i18n.changeLanguage("en")
    render(<MetricsPage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Metrics" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Metrics are coming soon",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "We’re building a reusable metrics catalog for measuring experiment outcomes. It’ll be available here soon."
      )
    ).toBeInTheDocument()
  })

  it("renders the Layers content", async () => {
    await i18n.changeLanguage("en")
    render(<LayersPage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Layers" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Layers are coming soon",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "We’re building a layer registry for assigning experiments to non-overlapping bucket ranges. It’ll be available here soon."
      )
    ).toBeInTheDocument()
  })

  it("uses the global Chinese resources", async () => {
    await i18n.changeLanguage("zh")
    render(<ExperimentsPage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "实验" })
    ).toBeInTheDocument()
    expect(screen.getByText("开发中")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "实验功能即将上线" })
    ).toBeInTheDocument()
  })
})
