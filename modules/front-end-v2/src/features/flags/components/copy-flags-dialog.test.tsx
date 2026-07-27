import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FeatureFlag } from "../flags-types"
import { CopyFlagsDialog } from "./copy-flags-dialog"

const mocks = vi.hoisted(() => ({
  fetchProjects: vi.fn(),
  precheck: vi.fn(),
}))

vi.mock("@/features/layout/layout-context", () => ({
  getCurrentProjectEnv: () => ({
    projectId: "source-project",
    projectName: "Source project",
    projectKey: "source-project",
    envId: "source-env",
    envName: "Development",
    envKey: "development",
  }),
  fetchProjects: mocks.fetchProjects,
  localizedPath: (_lang: string, path: string) => `/en${path}`,
}))

vi.mock("../flags-api", () => ({
  precheckCopyFeatureFlags: mocks.precheck,
  copyFeatureFlags: vi.fn(),
}))

const flag: FeatureFlag = {
  id: "flag-1",
  name: "Checkout flow",
  key: "checkout-flow",
  description: "",
  tags: ["checkout", "beta"],
  isEnabled: true,
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
  variationType: "boolean",
}
const secondFlag: FeatureFlag = {
  ...flag,
  id: "flag-2",
  name: "Checkout redesign",
  key: "checkout-redesign",
  tags: ["release"],
}

describe("CopyFlagsDialog", () => {
  beforeEach(() => {
    mocks.fetchProjects.mockReset()
    mocks.precheck.mockReset()
    mocks.fetchProjects.mockResolvedValue([
      {
        id: "target-project",
        name: "Target project",
        key: "target-project",
        environments: [
          {
            id: "target-env-id",
            projectId: "target-project",
            name: "Production",
            key: "production",
          },
        ],
      },
    ])
    mocks.precheck.mockResolvedValue([
      {
        id: flag.id,
        keyCheck: true,
        targetUserCheck: false,
        targetRuleCheck: false,
        newProperties: ["plan"],
        passed: false,
      },
    ])
  })

  function renderDialog(flags: FeatureFlag[] = [flag]) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <CopyFlagsDialog
            lang="en"
            envId="source-env"
            flags={flags}
            open
            onOpenChange={vi.fn()}
            onSuccess={vi.fn()}
          />
        </QueryClientProvider>
      </MemoryRouter>
    )
  }

  async function selectTarget() {
    const environmentSelect = screen.getByRole("combobox")
    fireEvent.click(environmentSelect)
    const targetOption = await screen.findByRole("option", {
      name: "Target project / Production",
    })
    fireEvent.pointerDown(targetOption, { pointerType: "mouse" })
    fireEvent.click(targetOption)

    await waitFor(() =>
      expect(environmentSelect).toHaveTextContent("Target project / Production")
    )
    return environmentSelect
  }

  it("shows limitations and requires an explicit acknowledgement", async () => {
    renderDialog()

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveClass("sm:max-w-[720px]")
    expect(
      screen.getByRole("heading", { name: "Copy to environment" })
    ).toBeVisible()
    expect(
      screen.getByText(
        "Choose a target environment and review what can be copied."
      )
    ).toBeVisible()
    expect(dialog.querySelector('[data-slot="dialog-header"]')).not.toHaveClass(
      "border-b"
    )
    expect(
      screen.queryByRole("checkbox", { name: "Select Checkout flow" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Flags to copy")).not.toBeInTheDocument()
    expect(screen.getByText("Source")).toHaveClass("row-start-1")
    expect(screen.getByText("Target environment")).toHaveClass("row-start-1")
    const sourceEnvironment = screen.getByTestId("copy-source-environment")
    expect(sourceEnvironment).toHaveClass("row-start-2", "h-7", "items-center")
    expect(sourceEnvironment.querySelector("svg")).toBeInTheDocument()

    const environmentSelect = await selectTarget()
    const targetEnvironment = screen.getByTestId("copy-target-environment")
    expect(targetEnvironment).toHaveClass("row-start-2")
    expect(environmentSelect).toHaveAttribute("data-size", "sm")
    expect(environmentSelect.querySelector("svg")).toBeInTheDocument()
    expect(screen.getByTestId("copy-flags-scroll-area")).toHaveClass(
      "overflow-y-auto"
    )
    expect(sourceEnvironment.parentElement).toHaveClass("shrink-0")
    expect(environmentSelect).not.toHaveTextContent("target-env-id")
    expect(await screen.findByText("Copy with limitations")).toBeVisible()
    expect(
      screen.getByText("Individual targeting won't be copied")
    ).toBeVisible()
    expect(screen.getByText("Targeting rules won't be copied")).toBeVisible()
    expect(screen.getByText("User properties to add:")).toBeVisible()
    expect(screen.getByText(/plan/)).toBeVisible()
    expect(screen.queryByText("checkout")).not.toBeInTheDocument()
    expect(screen.queryByText("beta")).not.toBeInTheDocument()

    expect(screen.getByText("0 / 1 flags selected")).toBeVisible()
    const copyButton = screen.getByRole("button", { name: "Copy 0 flags" })
    expect(copyButton).toBeDisabled()

    const acknowledgement = screen.getByRole("checkbox", {
      name: "Copy Checkout flow without limited settings",
    })
    fireEvent.click(acknowledgement)
    expect(acknowledgement).toBeChecked()
    expect(screen.getByText("1 / 1 flags selected")).toBeVisible()
    expect(copyButton).toBeEnabled()

    fireEvent.click(acknowledgement)
    expect(acknowledgement).not.toBeChecked()
    expect(copyButton).toBeDisabled()

    fireEvent.click(
      screen.getByRole("button", {
        name: /^Copy this flag without these settings/,
      })
    )
    expect(acknowledgement).toBeChecked()
    expect(copyButton).toBeEnabled()
  })

  it("separates multi-flag selection from limitation acknowledgement", async () => {
    mocks.precheck.mockResolvedValue([
      {
        id: flag.id,
        keyCheck: true,
        targetUserCheck: false,
        targetRuleCheck: true,
        newProperties: [],
        passed: false,
      },
      {
        id: secondFlag.id,
        keyCheck: true,
        targetUserCheck: true,
        targetRuleCheck: true,
        newProperties: [],
        passed: true,
      },
    ])
    renderDialog([flag, secondFlag])
    await selectTarget()
    await screen.findByText("Copy with limitations")

    expect(
      screen.queryByRole("checkbox", { name: "Select Checkout flow" })
    ).not.toBeInTheDocument()
    const safeFlagSelection = screen.getByRole("checkbox", {
      name: "Select Checkout redesign",
    })
    const acknowledgement = screen.getByRole("checkbox", {
      name: "Copy Checkout flow without limited settings",
    })
    const copyButton = screen.getByRole("button", { name: "Copy 1 flag" })

    expect(safeFlagSelection).toBeChecked()
    expect(acknowledgement).not.toBeChecked()
    expect(screen.getByText("1 / 2 flags selected")).toBeVisible()
    expect(copyButton).toBeEnabled()

    fireEvent.click(acknowledgement)
    expect(safeFlagSelection).toBeChecked()
    expect(acknowledgement).toBeChecked()
    expect(screen.getByText("2 / 2 flags selected")).toBeVisible()
    expect(screen.getByRole("button", { name: "Copy 2 flags" })).toBeEnabled()
  })

  it("enables copying when all checks pass", async () => {
    mocks.precheck.mockResolvedValue([
      {
        id: flag.id,
        keyCheck: true,
        targetUserCheck: true,
        targetRuleCheck: true,
        newProperties: [],
        passed: true,
      },
      {
        id: secondFlag.id,
        keyCheck: true,
        targetUserCheck: true,
        targetRuleCheck: true,
        newProperties: [],
        passed: true,
      },
    ])
    renderDialog([flag, secondFlag])
    await selectTarget()

    expect(await screen.findAllByText("Ready to copy")).toHaveLength(2)
    expect(screen.getAllByText("All copy checks passed.")).toHaveLength(2)
    expect(
      screen.getByRole("checkbox", { name: "Select Checkout flow" })
    ).toBeChecked()
    expect(
      screen.getByRole("checkbox", { name: "Select Checkout redesign" })
    ).toBeChecked()
    expect(screen.getByText("2 / 2 flags selected")).toBeVisible()
    expect(screen.getByRole("button", { name: "Copy 2 flags" })).toBeEnabled()
  })

  it("keeps key conflicts blocked and out of the selection", async () => {
    mocks.precheck.mockResolvedValue([
      {
        id: flag.id,
        keyCheck: false,
        targetUserCheck: true,
        targetRuleCheck: true,
        newProperties: [],
        passed: false,
      },
    ])
    renderDialog()
    await selectTarget()

    expect(await screen.findByText("This flag cannot be copied")).toBeVisible()
    expect(
      screen.getByText(
        "A flag with this key already exists in the target environment."
      )
    ).toBeVisible()
    expect(
      screen.queryByRole("checkbox", { name: "Select Checkout flow" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("0 / 1 flags selected")).toBeVisible()
    expect(screen.getByRole("button", { name: "Copy 0 flags" })).toBeDisabled()
  })

  it("offers a retry when the precheck fails", async () => {
    mocks.precheck.mockRejectedValue(new Error("network error"))
    renderDialog()
    await selectTarget()

    expect(
      await screen.findByText("Precheck failed. Please try again.")
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible()
  })

  it("shows the unavailable state for permission or license failures", async () => {
    mocks.precheck.mockRejectedValue(new Error("Forbidden"))
    renderDialog()
    await selectTarget()

    expect(await screen.findByText("Copy unavailable")).toBeVisible()
    expect(
      screen.getByText(
        "Your permissions or current license don't allow copying these flags."
      )
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Learn more" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Copy 0 flags" })).toBeDisabled()
  })

  it("keeps the flag identity visible while checking", async () => {
    mocks.precheck.mockReturnValue(new Promise(() => undefined))
    renderDialog()
    await selectTarget()

    expect(
      await screen.findByText("Checking whether these flags can be copied…")
    ).toBeVisible()
    expect(screen.getByText("Checkout flow")).toBeVisible()
    expect(screen.getByText("checkout-flow")).toBeVisible()
    expect(screen.getByRole("button", { name: "Copy 0 flags" })).toBeDisabled()
  })
})
import "@/lib/i18n/i18n"
