import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { RelationshipOptionsLoader } from "../relationship-options-cache"
import { RelationshipPickerSheet } from "./relationship-picker-sheet"

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

function renderSheet(
  loadOptions: RelationshipOptionsLoader,
  kind: "groups" | "policies" = "groups",
  noAvailableMessage?: string
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RelationshipPickerSheet
        open
        title={
          kind === "groups" ? "Add Alex to groups" : "Attach policies to Alex"
        }
        kind={kind}
        cacheKey={`test:member-1:${kind}`}
        saving={false}
        loadOptions={loadOptions}
        noAvailableMessage={noAvailableMessage}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    </QueryClientProvider>
  )
}

function groupPage(hasMore = false) {
  return {
    items: [{ id: "group-1", name: "Group one" }],
    hasMore,
  }
}

function policyPage(hasMore = false) {
  return {
    items: [{ id: "policy-1", name: "Policy one" }],
    hasMore,
  }
}

async function selectGroupAndOpenSelectedFilter() {
  fireEvent.click(await screen.findByRole("option", { name: "Group one" }))
  fireEvent.click(screen.getByRole("button", { name: "Selected (1)" }))
}

describe("RelationshipPickerSheet groups", () => {
  beforeEach(() => {
    intersectionCallback = undefined
    intersectionObserver = undefined
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns to All after clearing every selected group", async () => {
    renderSheet(vi.fn().mockResolvedValue(groupPage()))
    await selectGroupAndOpenSelectedFilter()

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Selected (0)" })).toBeDisabled()
    expect(
      await screen.findByRole("option", { name: "Group one" })
    ).toBeVisible()
  })

  it("returns to All after removing the last selected group", async () => {
    renderSheet(vi.fn().mockResolvedValue(groupPage()))
    await selectGroupAndOpenSelectedFilter()

    fireEvent.click(screen.getByRole("button", { name: "Remove Group one" }))

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
      .mockResolvedValueOnce(groupPage())
    renderSheet(loadOptions)

    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("We couldn't load groups.")
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("option", { name: "Group one" })
    ).toBeVisible()
    expect(loadOptions).toHaveBeenNthCalledWith(1, "", 0)
    expect(loadOptions).toHaveBeenNthCalledWith(2, "", 0)
  })

  it("shows the search query and clears a search with no matches", async () => {
    const loadOptions = vi.fn((query: string) =>
      Promise.resolve(query ? { items: [], hasMore: false } : groupPage())
    )
    renderSheet(loadOptions)
    expect(
      await screen.findByRole("option", { name: "Group one" })
    ).toBeVisible()

    const search = screen.getByPlaceholderText("Search groups")
    fireEvent.change(search, { target: { value: "ghost" } })

    expect(await screen.findByText(/No groups match.*ghost/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))

    expect(search).toHaveValue("")
    expect(
      await screen.findByRole("option", { name: "Group one" })
    ).toBeVisible()
  })

  it("explains when the member already belongs to every available group", async () => {
    renderSheet(
      vi.fn().mockResolvedValue({
        items: [],
        hasMore: false,
      })
    )

    expect(
      await screen.findByText(
        "This member already belongs to every available group."
      )
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Clear search" })
    ).not.toBeInTheDocument()
  })

  it("uses a supplied policy-context no-available message", async () => {
    renderSheet(
      vi.fn().mockResolvedValue({ items: [], hasMore: false }),
      "groups",
      "Every available group is already assigned to this policy."
    )

    expect(
      await screen.findByText(
        "Every available group is already assigned to this policy."
      )
    ).toBeVisible()
  })

  it("keeps loaded groups when loading more fails and retries the same page", async () => {
    const loadOptions = vi
      .fn()
      .mockResolvedValueOnce(groupPage(true))
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce({
        items: [{ id: "group-2", name: "Group two" }],
        hasMore: false,
      })
    renderSheet(loadOptions)

    expect(
      await screen.findByRole("option", { name: "Group one" })
    ).toBeVisible()
    await waitFor(() => expect(intersectionCallback).toBeDefined())

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        intersectionObserver as IntersectionObserver
      )
    })

    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("Couldn't load more groups.")
    expect(screen.getByRole("option", { name: "Group one" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("option", { name: "Group two" })
    ).toBeVisible()
    expect(screen.getByRole("option", { name: "Group one" })).toBeVisible()
    expect(loadOptions).toHaveBeenNthCalledWith(2, "", 1)
    expect(loadOptions).toHaveBeenNthCalledWith(3, "", 1)
  })
})

describe("RelationshipPickerSheet policies", () => {
  beforeEach(() => {
    intersectionCallback = undefined
    intersectionObserver = undefined
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function selectPolicyAndOpenSelectedFilter() {
    fireEvent.click(await screen.findByRole("option", { name: "Policy one" }))
    fireEvent.click(screen.getByRole("button", { name: "Selected (1)" }))
  }

  it("uses the same unframed picker layout as Add to groups", async () => {
    renderSheet(vi.fn().mockResolvedValue(policyPage()), "policies")

    const search = screen.getByPlaceholderText("Search policies")
    expect(
      await screen.findByRole("option", { name: "Policy one" })
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
  })

  it("returns to All after clearing every selected policy", async () => {
    renderSheet(vi.fn().mockResolvedValue(policyPage()), "policies")
    await selectPolicyAndOpenSelectedFilter()

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Selected (0)" })).toBeDisabled()
    expect(
      await screen.findByRole("option", { name: "Policy one" })
    ).toBeVisible()
  })

  it("returns to All after removing the last selected policy", async () => {
    renderSheet(vi.fn().mockResolvedValue(policyPage()), "policies")
    await selectPolicyAndOpenSelectedFilter()

    fireEvent.click(screen.getByRole("button", { name: "Remove Policy one" }))

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Selected (0)" })).toBeDisabled()
  })

  it("retries an initial policy load failure", async () => {
    const loadOptions = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(policyPage())
    renderSheet(loadOptions, "policies")

    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("We couldn't load policies.")
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("option", { name: "Policy one" })
    ).toBeVisible()
    expect(loadOptions).toHaveBeenNthCalledWith(1, "", 0)
    expect(loadOptions).toHaveBeenNthCalledWith(2, "", 0)
  })

  it("shows the policy search query and clears a search with no matches", async () => {
    const loadOptions = vi.fn((query: string) =>
      Promise.resolve(query ? { items: [], hasMore: false } : policyPage())
    )
    renderSheet(loadOptions, "policies")
    expect(
      await screen.findByRole("option", { name: "Policy one" })
    ).toBeVisible()

    const search = screen.getByPlaceholderText("Search policies")
    fireEvent.change(search, { target: { value: "ghost" } })

    expect(await screen.findByText(/No policies match.*ghost/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))

    expect(search).toHaveValue("")
    expect(
      await screen.findByRole("option", { name: "Policy one" })
    ).toBeVisible()
  })

  it("explains when every available policy is already assigned", async () => {
    renderSheet(
      vi.fn().mockResolvedValue({
        items: [],
        hasMore: false,
      }),
      "policies"
    )

    expect(
      await screen.findByText(
        "Every available policy is already assigned directly."
      )
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Clear search" })
    ).not.toBeInTheDocument()
  })

  it("keeps loaded policies when loading more fails and retries the same page", async () => {
    const loadOptions = vi
      .fn()
      .mockResolvedValueOnce(policyPage(true))
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce({
        items: [{ id: "policy-2", name: "Policy two" }],
        hasMore: false,
      })
    renderSheet(loadOptions, "policies")

    expect(
      await screen.findByRole("option", { name: "Policy one" })
    ).toBeVisible()
    await waitFor(() => expect(intersectionCallback).toBeDefined())

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        intersectionObserver as IntersectionObserver
      )
    })

    const error = await screen.findByRole("alert")
    expect(error).toHaveTextContent("Couldn't load more policies.")
    expect(screen.getByRole("option", { name: "Policy one" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("option", { name: "Policy two" })
    ).toBeVisible()
    expect(screen.getByRole("option", { name: "Policy one" })).toBeVisible()
    expect(loadOptions).toHaveBeenNthCalledWith(2, "", 1)
    expect(loadOptions).toHaveBeenNthCalledWith(3, "", 1)
  })
})
