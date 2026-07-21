import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { useState } from "react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { ResourcePicker } from "./resource-picker"

const resource = {
  id: "env-prod",
  name: "Production",
  rn: "project/shop:env/prod",
  type: "env" as const,
}

const mocks = vi.hoisted(() => ({
  fetchPolicyResourceOptions: vi.fn(),
}))

vi.mock("../policy-resource-options-cache", () => ({
  fetchPolicyResourceOptions: mocks.fetchPolicyResourceOptions,
}))

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe("ResourcePicker", () => {
  it("returns to all resources after removing the last selected resource", async () => {
    mocks.fetchPolicyResourceOptions.mockResolvedValue([resource])
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    function ControlledResourcePicker() {
      const [resources, setResources] = useState([resource.rn])

      return (
        <ResourcePicker
          resourceType="env"
          resources={resources}
          onChange={setResources}
        />
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ControlledResourcePicker />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Manage" }))
    fireEvent.click(screen.getByRole("tab", { name: "Selected (1)" }))
    fireEvent.click(
      await screen.findByRole("option", {
        name: /Production.*project\/shop:env\/prod/,
      })
    )

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
        "aria-selected",
        "true"
      )
    )
    expect(screen.getByRole("tab", { name: "Selected (0)" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })

  it("edits the RN of a selected resource", async () => {
    mocks.fetchPolicyResourceOptions.mockResolvedValue([resource])
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    function ControlledResourcePicker() {
      const [resources, setResources] = useState([resource.rn])

      return (
        <ResourcePicker
          resourceType="env"
          resources={resources}
          onChange={setResources}
        />
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ControlledResourcePicker />
      </QueryClientProvider>
    )

    expect(screen.getByText(resource.rn)).toBeInTheDocument()
    expect(screen.getByText("Edit RN")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Edit resource name for prod" })
    )

    expect(
      screen.getByRole("heading", { name: "Edit resource scope (RN)" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Resource name (RN) uniquely identifies resources. All data can be seen as a resource, Project, Environment and Feature flag for example."
      )
    ).toBeInTheDocument()
    const preview = screen.getByLabelText("Resulting resource RN")
    const environment = screen.getByLabelText("Environment")
    expect(
      screen.getByText(
        "Any uses * to broaden access to every matching resource at that level."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("checkbox", { name: "Any project" })
    ).toBeInTheDocument()
    const anyEnvironment = within(
      environment.parentElement as HTMLElement
    ).getByRole("checkbox", {
      name: "Any environment",
    })
    expect(environment.parentElement).toContainElement(anyEnvironment)
    await waitFor(() => expect(environment).toHaveValue("prod"))
    expect(preview).toHaveValue("project/shop:env/prod")

    fireEvent.change(environment, { target: { value: "staging" } })

    await waitFor(() => expect(preview).toHaveValue("project/shop:env/staging"))
    fireEvent.click(anyEnvironment)
    await waitFor(() => {
      expect(environment).toBeDisabled()
      expect(environment).toHaveValue("*")
      expect(preview).toHaveValue("project/shop:env/*")
    })

    fireEvent.click(anyEnvironment)
    await waitFor(() => {
      expect(environment).toBeEnabled()
      expect(environment).toHaveValue("staging")
      expect(preview).toHaveValue("project/shop:env/staging")
    })

    const apply = screen.getByRole("button", { name: "Apply" })
    await waitFor(() => expect(apply).toBeEnabled())
    fireEvent.click(apply)

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Edit resource name for staging",
        })
      ).toBeInTheDocument()
    )
  })

  it("normalizes an any-project RN to the all-project resource pattern", async () => {
    mocks.fetchPolicyResourceOptions.mockResolvedValue([])
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <ResourcePicker
          resourceType="project"
          resources={["project/shop", "project/store"]}
          onChange={onChange}
        />
      </QueryClientProvider>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Edit resource name for shop" })
    )
    const project = screen.getByLabelText("Project")
    const preview = screen.getByLabelText("Resulting resource RN")
    await waitFor(() => expect(project).toHaveValue("shop"))

    fireEvent.click(screen.getByRole("checkbox", { name: "Any project" }))
    await waitFor(() => expect(preview).toHaveValue("project/*"))

    const apply = screen.getByRole("button", { name: "Apply" })
    await waitFor(() => expect(apply).toBeEnabled())
    fireEvent.click(apply)

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(["project/*"])
    )
  })
})
