import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { Project } from "../layout-types"
import { ContextBar } from "./context-bar"

Element.prototype.scrollIntoView = vi.fn()

const projects: Project[] = [
  ["archive", "Orders Archive", "orders-archive"],
  ["bad00000-0000-4000-8000-000000000001", "Store Admin", "store-admin"],
  ["orders", "Orders", "order-service"],
].map(([id, name, key]) => ({
  id,
  name,
  key,
  environments: ["Test", "Prod", "Dev"].map((name) => ({
    id: `${id}-${name}`,
    name,
    key: name.toLowerCase(),
  })),
}))

async function openSwitcher() {
  const onChange = vi.fn()
  render(
    <MemoryRouter>
      <ContextBar
        organization={null}
        projects={projects}
        currentProjectEnv={{
          projectId: projects[1].id,
          projectName: "Store Admin",
          projectKey: "store-admin",
          envId: projects[1].environments[0].id,
          envName: "Test",
          envKey: "test",
        }}
        canViewSecrets={false}
        onProjectEnvChange={onChange}
      />
    </MemoryRouter>
  )
  fireEvent.click(screen.getByRole("button", { name: "Test" }))
  const input = await screen.findByPlaceholderText(
    "Search projects or environments..."
  )
  return { input, onChange }
}

const groups = () =>
  within(screen.getByRole("listbox"))
    .getAllByRole("group")
    .map((group) => group.getAttribute("aria-labelledby"))
    .map((id) => document.getElementById(id!)?.textContent)

describe("environment switcher search", () => {
  it("removes fuzzy matches, ranks exact projects first and selects the first result on Enter", async () => {
    const { input, onChange } = await openSwitcher()
    expect(groups()[0]).toBe("Store Admin · Current")
    fireEvent.change(input, { target: { value: "  ORDERS  " } })
    await waitFor(() => expect(groups()).toEqual(["Orders", "Orders Archive"]))
    expect(screen.getAllByRole("option")).toHaveLength(6)
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "orders", envKey: "test" })
    )
  })

  it("supports environment and combined project/environment searches, plus arrow navigation", async () => {
    const { input, onChange } = await openSwitcher()
    fireEvent.change(input, { target: { value: "prod" } })
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3))
    expect(
      screen.getAllByRole("option").every((item) => item.textContent === "Prod")
    ).toBe(true)
    fireEvent.change(input, { target: { value: "orders dev" } })
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2))
    expect(
      screen.getAllByRole("option").every((item) => item.textContent === "Dev")
    ).toBe(true)
    fireEvent.change(input, { target: { value: "order-service" } })
    await waitFor(() => expect(groups()).toEqual(["Orders"]))
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "orders", envKey: "prod" })
    )
  })

  it("does not search IDs and recovers selection after empty results and clearing", async () => {
    const { input, onChange } = await openSwitcher()
    fireEvent.change(input, { target: { value: "bad" } })
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0))
    expect(screen.getByText("No environments found.")).toBeVisible()
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: "orders" } })
    await waitFor(() => expect(groups()[0]).toBe("Orders"))
    fireEvent.change(input, { target: { value: "" } })
    await waitFor(() => expect(groups()[0]).toBe("Store Admin · Current"))
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: projects[1].id })
    )
  })
})
