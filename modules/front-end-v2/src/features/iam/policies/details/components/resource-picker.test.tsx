import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
})
