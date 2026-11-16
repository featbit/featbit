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
  it.each([
    {
      resourceType: "project" as const,
      label: "Project",
      anyLabel: "Any project",
      rn: "project/shop",
    },
    {
      resourceType: "env" as const,
      label: "Environment",
      anyLabel: "Any environment",
      rn: "project/*:env/production",
    },
  ])(
    "adds a custom $resourceType RN only after Done",
    async ({ resourceType, label, anyLabel, rn }) => {
      mocks.fetchPolicyResourceOptions.mockResolvedValue([])
      const onChange = vi.fn()
      render(
        <QueryClientProvider client={new QueryClient()}>
          <ResourcePicker
            resourceType={resourceType}
            resources={[]}
            onChange={onChange}
          />
        </QueryClientProvider>
      )
      fireEvent.click(screen.getByRole("button", { name: "Manage" }))
      fireEvent.click(screen.getByRole("button", { name: "Add custom RN" }))
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled()
      )
      expect(screen.queryByLabelText("Tags")).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole("checkbox", { name: anyLabel }))
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled()
      )
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: resourceType === "project" ? "shop" : "production" },
      })
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled()
      )
      expect(screen.getByLabelText("Resulting resource RN")).toHaveValue(rn)
      fireEvent.click(screen.getByRole("button", { name: "Apply" }))
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.click(await screen.findByRole("button", { name: "Done" }))
      expect(onChange).toHaveBeenCalledWith([rn])
    }
  )

  it("keeps selections pending until Done and discards dismissed changes", async () => {
    const flag = {
      ...resource,
      rn: "project/shop:env/prod:flag/checkout",
      type: "flag",
    }
    mocks.fetchPolicyResourceOptions.mockResolvedValue([flag])
    const onChange = vi.fn()
    function Harness() {
      const [resources, setResources] = useState<string[]>([])
      return (
        <ResourcePicker
          resourceType="flag"
          resources={resources}
          onChange={(next) => {
            setResources(next)
            onChange(next)
          }}
        />
      )
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Harness />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Manage" }))
    fireEvent.click(await screen.findByRole("option", { name: /Production/ }))
    expect(onChange).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("button", { name: /Edit resource name for checkout/ })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByPlaceholderText(/Search resources/), {
      key: "Escape",
    })
    fireEvent.click(screen.getByRole("button", { name: "Manage" }))
    expect(
      screen.getByRole("tab", { name: "Selected (0)" })
    ).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("option", { name: /Production/ }))
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(onChange).toHaveBeenLastCalledWith([flag.rn])
    expect(
      screen.getByRole("button", { name: /Edit resource name for/ })
    ).toBeInTheDocument()
  })

  it.each(["flag", "segment"] as const)(
    "adds, validates, edits and removes a custom %s RN",
    async (resourceType) => {
      mocks.fetchPolicyResourceOptions.mockResolvedValue([])
      const queryClient = new QueryClient()
      const onChange = vi.fn()
      const existingRn = `project/shop:env/prod:${resourceType}/existing`
      const customRn = `project/*:env/*:${resourceType}/checkout;beta`

      function Harness() {
        const [resources, setResources] = useState([existingRn])
        return (
          <ResourcePicker
            resourceType={resourceType}
            resources={resources}
            onChange={(next) => {
              setResources(next)
              onChange(next)
            }}
          />
        )
      }

      render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      )

      async function openCustomEditor() {
        fireEvent.click(screen.getByRole("button", { name: "Manage" }))
        fireEvent.click(
          await screen.findByRole("button", { name: "Add custom RN" })
        )
        await screen.findByRole("heading", { name: "Edit resource scope (RN)" })
        await waitFor(() =>
          expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled()
        )
      }

      async function enterCustomRn() {
        const label = resourceType === "flag" ? "Feature flag" : "Segment"
        fireEvent.click(
          screen.getByRole("checkbox", {
            name: resourceType === "flag" ? "Any feature flag" : "Any segment",
          })
        )
        await waitFor(() =>
          expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled()
        )
        fireEvent.change(screen.getByLabelText(label), {
          target: { value: "checkout" },
        })
        fireEvent.change(screen.getByLabelText("Tags"), {
          target: { value: "beta" },
        })
        await waitFor(() =>
          expect(screen.getByLabelText("Resulting resource RN")).toHaveValue(
            customRn
          )
        )
      }

      await openCustomEditor()
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole("button", { name: "Done" }))
      onChange.mockClear()

      await openCustomEditor()
      await enterCustomRn()
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled()
      )
      fireEvent.click(screen.getByRole("button", { name: "Apply" }))
      expect(onChange).not.toHaveBeenCalled()
      expect(
        screen.queryByRole("button", {
          name: /Edit resource name for checkout/,
        })
      ).not.toBeInTheDocument()
      fireEvent.click(await screen.findByRole("button", { name: "Done" }))
      await waitFor(() =>
        expect(onChange).toHaveBeenLastCalledWith([existingRn, customRn])
      )
      expect(screen.getByText(customRn)).toBeInTheDocument()

      await openCustomEditor()
      await enterCustomRn()
      expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled()
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
      fireEvent.click(screen.getByRole("button", { name: "Done" }))

      fireEvent.click(
        screen.getByRole("button", { name: /Edit resource name for checkout/ })
      )
      fireEvent.change(screen.getByLabelText("Tags"), {
        target: { value: "release" },
      })
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled()
      )
      fireEvent.click(screen.getByRole("button", { name: "Apply" }))
      await waitFor(() =>
        expect(onChange).toHaveBeenLastCalledWith([
          existingRn,
          customRn.replace(";beta", ";release"),
        ])
      )
      fireEvent.click(screen.getByRole("button", { name: /Remove.*checkout/ }))
      expect(onChange).toHaveBeenLastCalledWith([existingRn])
    }
  )

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
