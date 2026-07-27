import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { createSegmentEndUser, searchSegmentUsers } from "../../segments-api"
import type { Segment, SegmentEndUser, SegmentRule } from "../../segments-types"
import { UserPicker } from "@/features/targeting/user-panel"
import { TargetingTab } from "./targeting-tab"

vi.mock("../../segments-api", () => ({
  createSegmentEndUser: vi.fn(),
  searchSegmentUsers: vi.fn(),
  updateSegmentTargeting: vi.fn(),
}))

function renderPicker(
  shared = false,
  otherKeys: string[] = [],
  onSelected?: (user: SegmentEndUser) => void
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  function Harness() {
    const [selectedUser, setSelectedUser] = useState<SegmentEndUser | null>(
      null
    )
    return (
      <>
        <UserPicker
          envId="env-1"
          shared={shared}
          selected={[]}
          excluded={otherKeys}
          disabled={false}
          onAdd={(user) => {
            setSelectedUser(user)
            onSelected?.(user)
          }}
        />
        {selectedUser ? <p>Selected {selectedUser.keyId}</p> : null}
      </>
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  )
}

function renderTargeting(rules: SegmentRule[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const segment: Segment = {
    id: "segment-1",
    name: "Release users",
    key: "release-users",
    type: "environment-specific",
    scopes: [],
    tags: [],
    description: "",
    updatedAt: "2026-07-24T08:00:00.000Z",
    isArchived: false,
    included: ["user-1"],
    excluded: [],
    rules,
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <TargetingTab
        envId="env-1"
        segment={segment}
        users={
          new Map([
            [
              "user-1",
              {
                id: "user-id-1",
                envId: null,
                keyId: "user-1",
                name: "Existing user",
              },
            ],
          ])
        }
        properties={[]}
        requireComment={false}
        canUpdateUsers
        canUpdateRules
        onSaved={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe("targeting UserPicker", () => {
  beforeEach(() => {
    vi.mocked(searchSegmentUsers).mockReset()
    vi.mocked(createSegmentEndUser).mockReset()
    vi.mocked(searchSegmentUsers).mockResolvedValue([])
    vi.mocked(createSegmentEndUser).mockResolvedValue({
      id: "user-1",
      envId: "env-1",
      keyId: "new-user",
      name: "new-user",
    })
  })

  it("creates a missing environment user and selects it", async () => {
    renderPicker()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Search by name or keyId to add",
      })
    )
    fireEvent.change(
      await screen.findByPlaceholderText("Search by name or keyId to add"),
      {
        target: { value: "new-user" },
      }
    )
    fireEvent.click(
      await screen.findByRole("option", {
        name: 'Create user "new-user"',
      })
    )

    await waitFor(() =>
      expect(createSegmentEndUser).toHaveBeenCalledWith("env-1", "new-user")
    )
    expect(await screen.findByText("Selected new-user")).toBeVisible()
  })

  it("does not offer creation for a shared segment", async () => {
    renderPicker(true)

    fireEvent.click(screen.getByRole("button", { name: /Search by name/ }))
    fireEvent.change(await screen.findByPlaceholderText(/Search by name/), {
      target: { value: "new-user" },
    })

    expect(
      await screen.findByText(
        "Shared segments can only target existing global users."
      )
    ).toBeVisible()
    expect(
      screen.queryByRole("option", { name: /Create user/ })
    ).not.toBeInTheDocument()
  })

  it("labels global users in search results", async () => {
    vi.mocked(searchSegmentUsers).mockResolvedValue([
      {
        id: "global-user-id",
        envId: null,
        keyId: "global-user",
        name: "Global account",
      },
    ])
    renderPicker()

    fireEvent.click(screen.getByRole("button", { name: /Search by name/ }))

    expect(await screen.findByText("Global account")).toBeVisible()
    expect(screen.getByText("Global user")).toBeVisible()
  })

  it("keeps environment and global users distinct when their keys match", async () => {
    const onSelected = vi.fn()
    vi.mocked(searchSegmentUsers).mockResolvedValue([
      {
        id: "environment-user-id",
        envId: "env-1",
        keyId: "shared-key",
        name: "Environment account",
      },
      {
        id: "global-user-id",
        envId: null,
        keyId: "shared-key",
        name: "Global account",
      },
    ])
    renderPicker(false, [], onSelected)

    fireEvent.click(screen.getByRole("button", { name: /Search by name/ }))

    const environmentOption = (
      await screen.findByText("Environment account")
    ).closest('[role="option"]')
    const globalOption = screen
      .getByText("Global account")
      .closest('[role="option"]')

    expect(environmentOption).toHaveAttribute(
      "data-value",
      "env-1:environment-user-id:shared-key"
    )
    expect(globalOption).toHaveAttribute(
      "data-value",
      "global:global-user-id:shared-key"
    )

    fireEvent.click(globalOption!)
    expect(onSelected).toHaveBeenCalledWith(
      expect.objectContaining({ id: "global-user-id", envId: null })
    )
  })

  it("does not offer creation for a user selected on the other side", async () => {
    renderPicker(false, ["new-user"])

    fireEvent.click(screen.getByRole("button", { name: /Search by name/ }))
    fireEvent.change(await screen.findByPlaceholderText(/Search by name/), {
      target: { value: "new-user" },
    })

    expect(await screen.findByText("No users found.")).toBeVisible()
    expect(
      screen.queryByRole("option", { name: /Create user/ })
    ).not.toBeInTheDocument()
  })
})

describe("TargetingTab actions", () => {
  it("adds a rule with one default condition", () => {
    renderTargeting()

    fireEvent.click(screen.getByRole("button", { name: "Add rule" }))

    expect(screen.getByDisplayValue("Rule 1")).toBeVisible()
    expect(screen.getByText("IF")).toBeVisible()
  })

  it("labels the first and following rule conditions with IF and AND", () => {
    renderTargeting([
      {
        id: "rule-1",
        name: "Multiple conditions",
        conditions: [
          { id: "condition-1", property: "name", op: "Equal", value: "one" },
          { id: "condition-2", property: "keyId", op: "Equal", value: "two" },
        ],
      },
    ])

    expect(screen.getByText("IF")).toBeVisible()
    expect(screen.getByText("AND")).toBeVisible()
  })

  it("shows the translated operator label instead of its internal value", () => {
    renderTargeting([
      {
        id: "rule-1",
        name: "Country rule",
        conditions: [
          {
            id: "condition-1",
            property: "country",
            op: "IsOneOf",
            value: ["DE", "FR"],
          },
        ],
      },
    ])

    expect(screen.getByText("is one of")).toBeVisible()
    expect(screen.queryByText("IsOneOf")).not.toBeInTheDocument()
  })

  it("shows Discard only while targeting has unsaved changes", async () => {
    renderTargeting()

    expect(screen.getByText("Global user")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Discard changes" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Included users" }).closest("section")
        ?.parentElement
    ).toHaveClass("grid-cols-1", "xl:grid-cols-2")

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Existing user" })
    )

    const discard = await screen.findByRole("button", {
      name: "Discard changes",
    })
    fireEvent.click(discard)

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Discard changes" })
      ).not.toBeInTheDocument()
    )
  })

  it("reorders rules from the drag handle", () => {
    const { container } = renderTargeting([
      {
        id: "rule-1",
        name: "First rule",
        conditions: [
          { id: "condition-1", property: "name", op: "Equal", value: "one" },
        ],
      },
      {
        id: "rule-2",
        name: "Second rule",
        conditions: [
          { id: "condition-2", property: "name", op: "Equal", value: "two" },
        ],
      },
    ])
    const values = new Map<string, string>()
    const setDragImage = vi.fn()
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: (type: string) => values.get(type) ?? "",
      setData: (type: string, value: string) => values.set(type, value),
      setDragImage,
    }
    const secondRule = container.querySelector('[data-rule-id="rule-2"]')

    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2)

    fireEvent.dragStart(
      screen.getByRole("button", { name: "Reorder First rule" }),
      { dataTransfer }
    )
    const dragPreview = document.querySelector<HTMLElement>(
      "[data-rule-drag-preview]"
    )
    expect(setDragImage).toHaveBeenCalledOnce()
    expect(dragPreview).toBeInTheDocument()
    expect(dragPreview).toHaveStyle({
      backgroundColor: "var(--background)",
      opacity: "1",
    })
    const dragHandle = screen.getByRole("button", {
      name: "Reorder First rule",
    })
    const moveEvent = createEvent.drag(dragHandle, { dataTransfer })
    Object.defineProperties(moveEvent, {
      clientX: { value: 120 },
      clientY: { value: 80 },
    })
    fireEvent(dragHandle, moveEvent)
    expect(dragPreview).toHaveStyle({
      transform: "translate3d(120px, 80px, 0)",
    })
    fireEvent.dragOver(secondRule!, { dataTransfer })
    fireEvent.drop(secondRule!, { dataTransfer })
    expect(
      document.querySelector("[data-rule-drag-preview]")
    ).not.toBeInTheDocument()

    expect(
      screen
        .getAllByRole("textbox", { name: "Rule name" })
        .map((input) => (input as HTMLInputElement).value)
    ).toEqual(["Second rule", "First rule"])
    expect(
      screen.getByRole("button", { name: "Discard changes" })
    ).toBeVisible()
  })

  it("reorders rules from the keyboard-accessible drag handle", () => {
    renderTargeting([
      {
        id: "rule-1",
        name: "First rule",
        conditions: [
          { id: "condition-1", property: "name", op: "Equal", value: "one" },
        ],
      },
      {
        id: "rule-2",
        name: "Second rule",
        conditions: [
          { id: "condition-2", property: "name", op: "Equal", value: "two" },
        ],
      },
    ])

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Reorder First rule" }),
      { key: "ArrowDown" }
    )

    expect(
      screen
        .getAllByRole("textbox", { name: "Rule name" })
        .map((input) => (input as HTMLInputElement).value)
    ).toEqual(["Second rule", "First rule"])
  })
})
