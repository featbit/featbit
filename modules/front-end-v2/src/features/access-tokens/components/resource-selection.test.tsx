import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useRef } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import "@/lib/i18n/i18n"
import "../access-tokens-i18n"
import { ResourceSelection } from "./resource-selection"

const mocks = vi.hoisted(() => ({
  fetchAccessTokenResources: vi.fn(),
}))

vi.mock("../access-tokens-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../access-tokens-api")>()),
  fetchAccessTokenResources: mocks.fetchAccessTokenResources,
}))

function ResourceSelectionHarness({
  resources = [],
  onChange,
}: {
  resources?: string[]
  onChange: (resources: string[]) => void
}) {
  const portalContainer = useRef<HTMLDivElement | null>(null)

  return (
    <Sheet open>
      <SheetContent showCloseButton={false}>
        <SheetTitle className="sr-only">Access token</SheetTitle>
        <div ref={portalContainer} data-testid="sheet-portal-container">
          <ResourceSelection
            portalContainer={portalContainer}
            resourceType="segment"
            resources={resources}
            readOnly={false}
            invalid={false}
            onChange={onChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

describe("ResourceSelection", () => {
  beforeEach(() => {
    mocks.fetchAccessTokenResources.mockReset()
    mocks.fetchAccessTokenResources.mockResolvedValue([
      {
        id: "segment-1",
        name: "Production segment",
        rn: "project/store:segment/production",
        type: "segment",
      },
    ])
  })

  it("opens inside the sheet container and selects a resource", async () => {
    const onChange = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ResourceSelectionHarness onChange={onChange} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Add resource" }))

    const searchInput = await screen.findByPlaceholderText(/Search resources/i)
    expect(screen.getByTestId("sheet-portal-container")).toContainElement(
      searchInput
    )

    fireEvent.click(await screen.findByText("Production segment"))
    expect(onChange).toHaveBeenCalledWith(["project/store:segment/production"])
  })

  it("edits the RN of a selected resource", async () => {
    const onChange = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const selectedRn =
      "project/shop:env/production:segment/beta-users;release,beta"

    render(
      <QueryClientProvider client={queryClient}>
        <ResourceSelectionHarness
          resources={[selectedRn]}
          onChange={onChange}
        />
      </QueryClientProvider>
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit shop / production / beta-users;release,beta",
      })
    )

    expect(
      screen.getByRole("heading", { name: "Edit resource scope (RN)" })
    ).toBeInTheDocument()
    const segment = screen.getByLabelText("Segment")
    const preview = screen.getByLabelText("Resulting resource RN")
    await waitFor(() => expect(segment).toHaveValue("beta-users"))
    expect(screen.getByLabelText("Tags")).toHaveValue("release,beta")

    fireEvent.change(segment, { target: { value: "early-access" } })
    await waitFor(() =>
      expect(preview).toHaveValue(
        "project/shop:env/production:segment/early-access;release,beta"
      )
    )

    const apply = screen.getByRole("button", { name: "Apply" })
    await waitFor(() => expect(apply).toBeEnabled())
    fireEvent.click(apply)

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        "project/shop:env/production:segment/early-access;release,beta",
      ])
    )
  })
})
