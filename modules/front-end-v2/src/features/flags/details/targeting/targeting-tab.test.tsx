import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { FeatureFlag } from "../../flags-types"
import { TargetingTab } from "./targeting-tab"

window.HTMLElement.prototype.scrollIntoView = vi.fn()

function exampleFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: "flag-1",
    envId: "env-1",
    revision: "1",
    name: "Checkout redesign",
    key: "checkout-redesign",
    tags: ["checkout", "growth"],
    isEnabled: true,
    createdAt: "2026-07-01T10:00:00Z",
    updatedAt: "2026-07-24T14:32:00Z",
    variationType: "string",
    variations: [
      { id: "control", name: "Control", value: "control" },
      { id: "new", name: "New checkout", value: "new" },
      { id: "preview", name: "Internal preview", value: "preview" },
    ],
    disabledVariationId: "control",
    targetUsers: [
      { variationId: "control", keyIds: ["user-1"] },
      { variationId: "new", keyIds: [] },
      { variationId: "preview", keyIds: [] },
    ],
    rules: [],
    fallthrough: {
      dispatchKey: "keyId",
      variations: [
        { id: "control", rollout: [0, 0.75] },
        { id: "new", rollout: [0.75, 1] },
      ],
    },
    ...overrides,
  }
}

function renderTargeting(flag = exampleFlag(), dirty = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const props = {
    lang: "en" as const,
    flag,
    users: new Map([
      [
        "user-1",
        { id: "id-1", envId: "env-1", keyId: "user-1", name: "Aisha Khan" },
      ],
    ]),
    properties: [],
    pendingCount: 2,
    dirty,
    saving: false,
    toggling: false,
    canToggle: true,
    canUpdateDefault: true,
    canUpdateUsers: true,
    canUpdateRules: true,
    onDraftChange: vi.fn(),
    onResolveUser: vi.fn(),
    onDiscard: vi.fn(),
    onReview: vi.fn(),
    onOpenPending: vi.fn(),
    scheduleGranted: true,
    changeRequestGranted: true,
    onSchedule: vi.fn(),
    onChangeRequest: vi.fn(),
    onToggle: vi.fn(),
  }
  const result = render(
    <QueryClientProvider client={client}>
      <TargetingTab {...props} />
    </QueryClientProvider>
  )
  return { ...props, ...result }
}

describe("feature flag targeting tab", () => {
  it("renders the default rule, one user panel per variation, and toolbar actions", async () => {
    const props = renderTargeting()
    const defaultRuleHeading = screen.getByRole("heading", {
      name: "Default rule",
    })
    expect(defaultRuleHeading).toBeVisible()
    expect(
      screen.getByText("Used when no individual target and rule matches.")
    ).toBeVisible()
    const statusHeading = screen.getByRole("heading", { name: "Flag status" })
    expect(statusHeading).toBeVisible()
    expect(
      screen.getByText(
        "Status changes apply immediately and are not included in Review & save."
      )
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Targeting configuration" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Edit default serving, individual targeting, and rules.")
    ).not.toBeInTheDocument()
    const statusSwitch = screen.getByRole("switch", {
      name: "Toggle feature flag status",
    })
    expect(statusSwitch).toBeChecked()
    fireEvent.click(statusSwitch)
    expect(props.onToggle).toHaveBeenCalledWith(false, expect.anything())
    const individualTargeting = screen.getByText("Individual targeting")
    const individualTargetingHelp = screen.getByText(
      "Target specific end users by keyId."
    )
    expect(individualTargeting).toBeVisible()
    expect(individualTargetingHelp).toBeVisible()
    expect(individualTargeting.parentElement).toBe(
      individualTargetingHelp.parentElement
    )
    expect(individualTargeting.parentElement).toHaveClass(
      "flex-wrap",
      "items-baseline",
      "gap-x-2"
    )
    expect(screen.getByText("Targeting rules")).toBeVisible()
    expect(
      screen.getByText(
        "No rules yet. Add a rule to match users by their properties."
      )
    ).toBeVisible()
    expect(
      screen.getByText(
        "When the flag is ON, matched users receive the rule’s variation; unmatched users fall through to the default rule."
      )
    ).toBeVisible()
    expect(screen.getByText("Internal preview")).toBeVisible()
    const review = screen.getByRole("button", { name: "Review & save" })
    const moreActions = screen.getByRole("button", {
      name: "More targeting actions",
    })
    expect(review).toBeEnabled()
    expect(review).toHaveClass("rounded-r-none", "border-r-0")
    expect(moreActions).toHaveClass("rounded-l-none")
    fireEvent.click(moreActions)
    await waitFor(() =>
      expect(screen.getByText("Schedule changes")).toBeVisible()
    )
    expect(
      screen.getByText("Schedule changes").closest('[role="menuitem"]')
    ).toHaveClass("cursor-pointer")
    expect(
      screen
        .getByText("Schedule changes")
        .closest('[role="menuitem"]')
        ?.querySelector(".lucide-clock-3")
    ).toBeVisible()
    const changeRequest = screen.getByText("Change request")
    expect(changeRequest).toBeVisible()
    expect(
      changeRequest
        .closest('[role="menuitem"]')
        ?.querySelector(".lucide-user-round-check")
    ).toBeVisible()
    fireEvent.click(screen.getByText("Schedule changes"))
    expect(props.onSchedule).toHaveBeenCalledOnce()
    const pendingChanges = screen.getByRole("button", {
      name: "2 pending changes",
    })
    expect(pendingChanges).toBeVisible()
    const toolbarSection = pendingChanges.closest("section")
    expect(toolbarSection).not.toBe(statusHeading.closest("section"))
    expect(toolbarSection).toBe(defaultRuleHeading.closest("section"))
    const defaultServing = screen.getByRole("combobox", {
      name: "Default rule serving variation",
    })
    expect(defaultServing).toHaveTextContent("Rollout percentage")
    expect(defaultServing).toHaveClass("w-72")
    expect(screen.getByText("Inactive now")).toBeVisible()
    expect(
      screen.queryByText(/is not currently returned by this rule/)
    ).toBeNull()
    const controlAllocation = screen.getByText("Control 75%")
    const newAllocation = screen.getByText("New checkout 25%")
    expect(controlAllocation.previousElementSibling).toHaveClass("bg-blue-600")
    expect(newAllocation.previousElementSibling).toHaveClass("bg-emerald-600")
  })

  it("shows the active OFF rule and inactive ON rule", () => {
    renderTargeting(exampleFlag({ isEnabled: false }))
    expect(
      screen.getByText(
        "Status changes apply immediately and are not included in Review & save."
      )
    ).toBeVisible()
    expect(
      screen.getByRole("switch", { name: "Toggle feature flag status" })
    ).not.toBeChecked()
    expect(screen.getByText("Inactive now")).toBeVisible()
    expect(screen.getByText("Active now")).toBeVisible()
    expect(
      screen.getByRole("combobox", { name: "Flag OFF serving variation" })
    ).toHaveClass("w-72")
    expect(
      screen.getByText("Control is returned for every evaluation.")
    ).toBeVisible()
  })

  it("keeps review disabled and omits discard when the draft is clean", () => {
    renderTargeting(exampleFlag(), false)
    expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull()
    expect(screen.getByRole("button", { name: "Review & save" })).toBeDisabled()
  })

  it("adds a rule through the shared Segment rule editor contract", () => {
    const props = renderTargeting()
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }))
    expect(props.onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rules: [
          expect.objectContaining({
            name: "Rule 1",
            conditions: [
              expect.objectContaining({
                property: "keyId",
                op: "Equal",
                value: "",
              }),
            ],
          }),
        ],
      })
    )
  })

  it("shows variation names rather than ids in serving selectors", () => {
    renderTargeting(
      exampleFlag({
        fallthrough: {
          dispatchKey: "keyId",
          variations: [{ id: "control", rollout: [0, 1] }],
        },
        rules: [
          {
            id: "rule-1",
            name: "Known users",
            dispatchKey: "keyId",
            conditions: [
              {
                id: "condition-1",
                property: "keyId",
                op: "Equal",
                value: "user-1",
              },
            ],
            variations: [{ id: "new", rollout: [0, 1] }],
          },
        ],
      })
    )

    const defaultServing = screen.getByRole("combobox", {
      name: "Default rule serving variation",
    })
    const ruleServing = screen.getByRole("combobox", {
      name: "Rule serving variation",
    })
    const offServing = screen.getByRole("combobox", {
      name: "Flag OFF serving variation",
    })
    expect(defaultServing).toHaveTextContent("Control")
    expect(defaultServing).not.toHaveTextContent("control")
    expect(ruleServing).toHaveTextContent("New checkout")
    expect(ruleServing).not.toHaveTextContent("new")
    expect(offServing).toHaveTextContent("Control")
    expect(offServing).not.toHaveTextContent("control")
    expect(ruleServing).toHaveClass("w-72")
  })

  it("uses the shared rule card preview while dragging", () => {
    const { container, onDraftChange } = renderTargeting(
      exampleFlag({
        rules: [
          {
            id: "rule-1",
            name: "First rule",
            conditions: [
              {
                id: "condition-1",
                property: "keyId",
                op: "Equal",
                value: "one",
              },
            ],
            variations: [{ id: "control", rollout: [0, 1] }],
          },
          {
            id: "rule-2",
            name: "Second rule",
            conditions: [
              {
                id: "condition-2",
                property: "keyId",
                op: "Equal",
                value: "two",
              },
            ],
            variations: [{ id: "new", rollout: [0, 1] }],
          },
        ],
      })
    )
    const values = new Map<string, string>()
    const setDragImage = vi.fn()
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: (type: string) => values.get(type) ?? "",
      setData: (type: string, value: string) => values.set(type, value),
      setDragImage,
    }
    const firstHandle = screen.getByRole("button", {
      name: "Reorder First rule",
    })

    fireEvent.dragStart(firstHandle, { dataTransfer })
    const preview = document.querySelector<HTMLElement>(
      "[data-rule-drag-preview]"
    )
    expect(setDragImage).toHaveBeenCalledOnce()
    expect(preview).toBeInTheDocument()

    const moveEvent = createEvent.drag(firstHandle, { dataTransfer })
    Object.defineProperties(moveEvent, {
      clientX: { value: 120 },
      clientY: { value: 80 },
    })
    fireEvent(firstHandle, moveEvent)
    expect(preview).toHaveStyle({
      transform: "translate3d(120px, 80px, 0)",
    })

    fireEvent.drop(container.querySelector('[data-flag-rule-id="rule-2"]')!, {
      dataTransfer,
    })
    expect(
      document.querySelector("[data-rule-drag-preview]")
    ).not.toBeInTheDocument()
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rules: [
          expect.objectContaining({ id: "rule-2" }),
          expect.objectContaining({ id: "rule-1" }),
        ],
      })
    )
  })
})
