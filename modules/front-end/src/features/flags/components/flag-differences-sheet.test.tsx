import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FeatureFlag, FlagComparisonDetail } from "../flags-types"
import { FlagDifferencesSheet } from "./flag-differences-sheet"

const mocks = vi.hoisted(() => ({
  fetchProjects: vi.fn(),
  compare: vi.fn(),
  copy: vi.fn(),
}))

vi.mock("@/features/layout/layout-context", () => ({
  getCurrentProjectEnv: () => ({
    projectId: "source-project",
    projectName: "Growth Platform",
    projectKey: "growth-platform",
    envId: "source-env",
    envName: "Production",
    envKey: "production",
  }),
  fetchProjects: mocks.fetchProjects,
  localizedPath: (lang: string, path: string) => `/${lang}${path}`,
}))

vi.mock("../flags-api", () => ({
  compareFeatureFlag: mocks.compare,
  copyFeatureFlagSettings: mocks.copy,
}))

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout redesign",
  key: "checkout-redesign",
  description: "",
  tags: [],
  isEnabled: true,
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
  variationType: "boolean",
}

const detail: FlagComparisonDetail = {
  source: {
    id: "flag-1",
    name: flag.name,
    key: flag.key,
    isEnabled: true,
    variations: [
      { id: "true", name: "Enabled", value: "true" },
      { id: "false", name: "Disabled", value: "false" },
    ],
    targetUsers: [{ variationId: "true", keyIds: ["u-1", "u-2"] }],
    rules: [
      {
        id: "source-rule",
        name: "US customers",
        conditions: [{ property: "country", op: "is one of", value: ["US"] }],
        variations: [{ id: "true", rollout: [0, 1] }],
      },
    ],
    fallthrough: { variations: [{ id: "true", rollout: [0, 0.75] }] },
    disabledVariationId: "false",
  },
  target: {
    id: "flag-2",
    name: flag.name,
    key: flag.key,
    isEnabled: false,
    variations: [
      { id: "true", name: "Enabled", value: "true" },
      { id: "false", name: "Disabled", value: "false" },
    ],
    targetUsers: [],
    rules: [],
    fallthrough: { variations: [{ id: "false", rollout: [0, 1] }] },
    disabledVariationId: "true",
  },
  diff: {
    onOffState: { source: true, target: false, isDifferent: true },
    individualTargeting: [{ isDifferent: true }],
    targetingRule: [{ isDifferent: true }],
    defaultRule: { isDifferent: false },
    offVariation: { isDifferent: true },
  },
  relatedSegments: [],
  isRulesCopyable: false,
}

describe("FlagDifferencesSheet", () => {
  beforeEach(() => {
    mocks.fetchProjects.mockReset()
    mocks.compare.mockReset()
    mocks.copy.mockReset()
    mocks.fetchProjects.mockResolvedValue([
      {
        id: "target-project",
        name: "Growth Platform",
        key: "growth-platform",
        environments: [
          { id: "source-env", name: "Production", key: "production" },
          { id: "target-env", name: "Staging", key: "staging" },
        ],
      },
    ])
    mocks.compare.mockResolvedValue(detail)
    mocks.copy.mockResolvedValue({})
  })

  function renderSheet(
    props: Partial<React.ComponentProps<typeof FlagDifferencesSheet>> = {}
  ) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <FlagDifferencesSheet
            lang="en"
            envId="source-env"
            flag={flag}
            open
            onOpenChange={vi.fn()}
            {...props}
          />
        </QueryClientProvider>
      </MemoryRouter>
    )
  }

  async function selectTarget() {
    const trigger = screen.getByRole("combobox")
    fireEvent.click(trigger)
    const option = await screen.findByRole("option", {
      name: "Growth Platform / Staging",
    })
    expect(option.querySelector("svg")).toBeInTheDocument()
    fireEvent.pointerDown(option, { pointerType: "mouse" })
    fireEvent.click(option)
    await screen.findByRole("checkbox", { name: "On/OFF state" })
  }

  it("uses target selection for the index entry and selects only eligible rows", async () => {
    renderSheet()

    expect(
      screen.getByRole("heading", { name: "Compare Checkout redesign" })
    ).toBeVisible()
    expect(
      screen.getByText("Select a target environment to view differences")
    ).toBeVisible()
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(screen.getByTestId("flag-difference-source")).toHaveClass("h-8")
    expect(screen.getByRole("combobox")).toHaveAttribute("data-size", "default")
    expect(document.querySelector('[data-slot="sheet-header"]')).toHaveClass(
      "border-b",
      "border-border"
    )
    expect(
      document.querySelector('[data-slot="sheet-header"]')
    ).not.toContainElement(screen.getByTestId("flag-difference-source"))
    expect(document.querySelector('[data-slot="sheet-footer"]')).toHaveClass(
      "bg-transparent"
    )
    expect(
      document.querySelector('[data-slot="sheet-footer"]')
    ).not.toHaveClass("border-t")

    await selectTarget()
    expect(mocks.compare).toHaveBeenCalledWith(
      "source-env",
      "target-env",
      "checkout-redesign"
    )
    expect(
      screen.getByTestId("source-settings-heading").querySelector("svg")
    ).toBeInTheDocument()
    expect(
      screen.getByTestId("target-settings-heading").querySelector("svg")
    ).toBeInTheDocument()
    expect(
      screen
        .getByTestId("source-settings-heading")
        .querySelector(".font-semibold")
    ).toHaveTextContent("Growth Platform / Production")
    expect(
      screen
        .getByTestId("target-settings-heading")
        .querySelector(".font-semibold")
    ).toHaveTextContent("Growth Platform / Staging")

    const selectAll = screen.getByRole("checkbox", { name: "Select all" })
    fireEvent.click(selectAll)
    expect(screen.getByText("3 settings selected")).toBeVisible()
    const disabledRules = screen.getByRole("checkbox", {
      name: "Targeting rules",
    })
    const unchangedDefault = screen.getByRole("checkbox", {
      name: "Default rule",
    })
    expect(disabledRules).toHaveAttribute("aria-disabled", "true")
    expect(disabledRules).toHaveAttribute("data-disabled", "")
    expect(disabledRules).toHaveAttribute("data-unchecked", "")
    expect(unchangedDefault).toHaveAttribute("aria-disabled", "true")
    expect(unchangedDefault).toHaveAttribute("data-disabled", "")
    expect(unchangedDefault).toHaveAttribute("data-unchecked", "")
  })

  it("shows a focused license gate without loading comparison controls", () => {
    renderSheet({ comparisonGranted: false })

    expect(
      screen.getByRole("heading", {
        name: "Your license doesn't include Feature Flag Comparison",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Manage license" })
    ).toHaveAttribute("href", "/en/workspace/license")
    expect(
      screen.queryByTestId("flag-difference-source")
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByText("No settings selected")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Copy settings" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible()
    expect(mocks.fetchProjects).not.toHaveBeenCalled()
    expect(mocks.compare).not.toHaveBeenCalled()
  })

  it("reuses the same sheet with a locked target and copies selected settings", async () => {
    const onOpenChange = vi.fn()
    renderSheet({
      lockedTarget: { id: "target-env", name: "Growth Platform / Staging" },
      onOpenChange,
    })

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    const onOffCheckbox = await screen.findByRole("checkbox", {
      name: "On/OFF state",
    })
    fireEvent.click(onOffCheckbox)
    fireEvent.click(screen.getByRole("button", { name: "Copy settings" }))

    await waitFor(() =>
      expect(mocks.copy).toHaveBeenCalledWith(
        "source-env",
        "target-env",
        "checkout-redesign",
        {
          onOffState: true,
          individualTargeting: { copy: false, mode: "overwrite" },
          targetingRule: { copy: false, mode: "overwrite" },
          defaultRule: false,
          offVariation: false,
        }
      )
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("changes the targeting-rule copy mode without closing the sheet", async () => {
    mocks.compare.mockResolvedValueOnce({
      ...detail,
      isRulesCopyable: true,
    })
    const onOpenChange = vi.fn()
    renderSheet({
      lockedTarget: { id: "target-env", name: "Growth Platform / Staging" },
      onOpenChange,
    })

    const targetingRules = await screen.findByRole("checkbox", {
      name: "Targeting rules",
    })
    fireEvent.click(targetingRules)

    const appendRulesLabel = screen.getByText("Append rules")
    const appendRules = screen.getByRole("radio", { name: "Append rules" })
    const inputId = appendRulesLabel.getAttribute("for")
    expect(inputId).toBeTruthy()
    expect(document.getElementById(inputId!)).toHaveAttribute("type", "radio")

    fireEvent.click(appendRulesLabel)

    expect(appendRules).toHaveAttribute("aria-checked", "true")
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("shows an environment icon when the flag is missing in the target", async () => {
    mocks.compare.mockResolvedValueOnce(null)
    renderSheet()

    fireEvent.click(screen.getByRole("combobox"))
    const option = await screen.findByRole("option", {
      name: "Growth Platform / Staging",
    })
    fireEvent.pointerDown(option, { pointerType: "mouse" })
    fireEvent.click(option)

    expect(
      await screen.findByText("Flag not found in target environment")
    ).toBeVisible()
    const environment = screen.getByTestId("missing-target-environment")
    expect(environment.querySelector("svg")).toBeInTheDocument()
    expect(environment).toHaveTextContent("Growth Platform / Staging")
  })
})
import "@/lib/i18n/i18n"
