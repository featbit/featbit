import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { RelationshipOptionPage } from "../../group-api"
import { RelationshipPickerSheet } from "./relationship-picker-sheet"

type PickerKind = "members" | "policies"
type OptionsLoader = (
  query: string,
  pageIndex: number
) => Promise<RelationshipOptionPage>

let intersectionCallback: IntersectionObserverCallback | undefined
let intersectionObserver: IntersectionObserver | undefined

class IntersectionObserverMock {
  readonly root = null
  readonly rootMargin = "0px"
  readonly thresholds = [0]

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback
    intersectionObserver = this as unknown as IntersectionObserver
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

const scenarios = [
  {
    kind: "members" as const,
    title: "Add members to Engineering",
    placeholder: "Search members",
    first: { id: "member-1", name: "Alex", email: "alex@example.com" },
    second: { id: "member-2", name: "Blair", email: "blair@example.com" },
    firstName: "Alex",
    secondName: "Blair",
    availableLabel: "Available members",
    loadFailed: "We couldn't load members.",
    loadMoreFailed: "Couldn't load more members.",
    noAvailable: "Every available member already belongs to this group.",
    searchPattern: /No members match.*ghost/,
  },
  {
    kind: "policies" as const,
    title: "Add policies to Engineering",
    placeholder: "Search policies",
    first: {
      id: "policy-1",
      name: "Policy one",
      description: "First policy",
    },
    second: {
      id: "policy-2",
      name: "Policy two",
      description: "Second policy",
    },
    firstName: "Policy one",
    secondName: "Policy two",
    availableLabel: "Available policies",
    loadFailed: "We couldn't load policies.",
    loadMoreFailed: "Couldn't load more policies.",
    noAvailable: "Every available policy is already assigned.",
    searchPattern: /No policies match.*ghost/,
  },
] as const

function renderSheet(
  kind: PickerKind,
  loadOptions: OptionsLoader,
  noAvailableMessage?: string
) {
  return render(
    <RelationshipPickerSheet
      open
      title={
        kind === "members"
          ? "Add members to Engineering"
          : "Add policies to Engineering"
      }
      kind={kind}
      saving={false}
      loadOptions={loadOptions}
      noAvailableMessage={noAvailableMessage}
      onOpenChange={vi.fn()}
      onSubmit={vi.fn()}
    />
  )
}

describe.each(scenarios)("RelationshipPickerSheet $kind", (scenario) => {
  beforeEach(() => {
    intersectionCallback = undefined
    intersectionObserver = undefined
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function page(hasMore = false): RelationshipOptionPage {
    return { items: [scenario.first], hasMore }
  }

  async function selectFirstAndOpenSelectedFilter() {
    fireEvent.click(
      await screen.findByRole("option", {
        name: new RegExp(scenario.firstName),
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Selected (1)" }))
  }

  it("uses the same unframed layout as Add to groups", async () => {
    renderSheet(scenario.kind, vi.fn().mockResolvedValue(page()))

    const search = screen.getByPlaceholderText(scenario.placeholder)
    expect(
      await screen.findByRole("option", {
        name: new RegExp(scenario.firstName),
      })
    ).toBeVisible()

    const command = search.closest('[data-slot="command"]')
    const searchSection = search.closest(
      '[data-slot="command-input-wrapper"]'
    )?.parentElement

    expect(command).toHaveClass(
      "border-0",
      "[&_[data-slot=input-group]]:border-input!",
      "[&_[data-slot=input-group]]:bg-background!"
    )
    expect(command).not.toHaveClass("border")
    expect(searchSection).toHaveClass("py-2")
    expect(searchSection).not.toHaveClass("px-2")
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.queryByText(scenario.availableLabel)).not.toBeInTheDocument()
  })

  it("returns to All after clearing every selected item", async () => {
    renderSheet(scenario.kind, vi.fn().mockResolvedValue(page()))
    await selectFirstAndOpenSelectedFilter()

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Selected (0)" })).toBeDisabled()
    expect(
      await screen.findByRole("option", {
        name: new RegExp(scenario.firstName),
      })
    ).toBeVisible()
  })

  it("returns to All after removing the last selected item", async () => {
    renderSheet(scenario.kind, vi.fn().mockResolvedValue(page()))
    await selectFirstAndOpenSelectedFilter()

    fireEvent.click(
      screen.getByRole("button", {
        name: `Remove ${scenario.firstName}`,
      })
    )

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Selected (0)" })).toBeDisabled()
  })

  it("retries an initial load failure", async () => {
    const loadOptions = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(page())
    renderSheet(scenario.kind, loadOptions)

    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent(scenario.loadFailed)
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("option", {
        name: new RegExp(scenario.firstName),
      })
    ).toBeVisible()
    expect(loadOptions).toHaveBeenNthCalledWith(1, "", 0)
    expect(loadOptions).toHaveBeenNthCalledWith(2, "", 0)
  })

  it("shows the query and clears a search with no matches", async () => {
    const loadOptions = vi.fn((query: string) =>
      Promise.resolve(query ? { items: [], hasMore: false } : page())
    )
    renderSheet(scenario.kind, loadOptions)
    expect(
      await screen.findByRole("option", {
        name: new RegExp(scenario.firstName),
      })
    ).toBeVisible()

    const search = screen.getByPlaceholderText(scenario.placeholder)
    fireEvent.change(search, { target: { value: "ghost" } })

    expect(await screen.findByText(scenario.searchPattern)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))

    expect(search).toHaveValue("")
    expect(
      await screen.findByRole("option", {
        name: new RegExp(scenario.firstName),
      })
    ).toBeVisible()
  })

  it("shows the true no-available state without recovery actions", async () => {
    renderSheet(
      scenario.kind,
      vi.fn().mockResolvedValue({ items: [], hasMore: false })
    )

    expect(await screen.findByText(scenario.noAvailable)).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Clear search" })
    ).not.toBeInTheDocument()
  })

  it("keeps loaded items when loading more fails and retries the same page", async () => {
    const loadOptions = vi
      .fn()
      .mockResolvedValueOnce(page(true))
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce({ items: [scenario.second], hasMore: false })
    renderSheet(scenario.kind, loadOptions)

    expect(
      await screen.findByRole("option", {
        name: new RegExp(scenario.firstName),
      })
    ).toBeVisible()
    await waitFor(() => expect(intersectionCallback).toBeDefined())

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        intersectionObserver as IntersectionObserver
      )
    })

    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent(scenario.loadMoreFailed)
    expect(
      screen.getByRole("option", { name: new RegExp(scenario.firstName) })
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("option", {
        name: new RegExp(scenario.secondName),
      })
    ).toBeVisible()
    expect(
      screen.getByRole("option", { name: new RegExp(scenario.firstName) })
    ).toBeVisible()
    expect(loadOptions).toHaveBeenNthCalledWith(2, "", 1)
    expect(loadOptions).toHaveBeenNthCalledWith(3, "", 1)
  })
})

describe("RelationshipPickerSheet contextual empty state", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses a supplied policy-context message", async () => {
    renderSheet(
      "members",
      vi.fn().mockResolvedValue({ items: [], hasMore: false }),
      "Every available member is already assigned to this policy."
    )

    expect(
      await screen.findByText(
        "Every available member is already assigned to this policy."
      )
    ).toBeVisible()
  })
})
