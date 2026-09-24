import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import type { FeatureFlag } from "@/features/flags/flags-types"
import { i18n } from "@/lib/i18n/i18n"
import { ApiRequestError } from "@/lib/api/authenticated-api"
import { FlagReleaseHealthTab } from "./flag-release-health-tab"
import { monitorApi } from "./monitor-api"
import {
  releaseHealthApi,
  type LiveMetric,
  type ReleaseHealthScope,
} from "../release-health-api"
import {
  bindingDefaults,
  bindingFromForm,
  bindingSchema,
  newAlertRule,
} from "./binding-form"
import type { MonitorBinding } from "../release-health-types"
import { checkoutMonitor, releaseMetrics } from "../release-health-mock-data"
import type { BindingMetric } from "./monitor-data"

const scope = vi.hoisted(() => ({
  userId: "tester",
  workspaceId: "workspace",
  organizationId: "org",
  projectId: "project",
}))
const webhookState = vi.hoisted(() => ({
  items: [] as {
    id: string
    name: string
    url: string
    isActive: boolean
    env: string
  }[],
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/auth-api", async (original) => ({
  ...(await original<typeof import("@/features/auth/auth-api")>()),
  getStoredUserProfile: () => ({ id: scope.userId }),
}))
vi.mock("@/features/layout/layout-context", async (original) => ({
  ...(await original<typeof import("@/features/layout/layout-context")>()),
  getCurrentWorkspace: () => ({ id: scope.workspaceId }),
  getCurrentOrganization: () => ({ id: scope.organizationId }),
  getCurrentProjectEnv: () => ({
    projectId: scope.projectId,
    envId: "prod",
    envName: "Production",
  }),
}))
vi.mock("./monitor-api", async (original) => ({
  ...(await original<typeof import("./monitor-api")>()),
  monitorApi: {
    get: vi.fn(),
    metrics: vi.fn(),
    add: vi.fn(),
    edit: vi.fn(),
    toggleBinding: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
  },
}))
vi.mock("../release-health-api", async (original) => ({
  ...(await original<typeof import("../release-health-api")>()),
  releaseHealthApi: { metrics: vi.fn(), trend: vi.fn(), binding: vi.fn() },
}))
vi.mock("./binding-webhooks", () => ({
  useBindingWebhooks: (_projectId: string, envId: string) => {
    const available = () =>
      webhookState.items.filter((item) => item.isActive && item.env === envId)
    return {
      data: available(),
      isPending: false,
      isLoading: false,
      isError: false,
      refetch: async () => ({ data: available(), isError: false }),
    }
  },
}))

const flag = { id: "flag", key: "checkout", name: "Checkout" } as FeatureFlag
const currentScope = { projectId: "project", envId: "prod" }
type ServerMonitor = Awaited<ReturnType<typeof monitorApi.get>>
type ServerBinding = ServerMonitor["bindings"][number]
const monitors = new Map<string, ServerMonitor>()
const liveMetrics: LiveMetric[] = releaseMetrics.map((metric) => ({
  id: metric.id,
  projectId: "project",
  metricVersionId: metric.id + "-v" + metric.version,
  version: metric.version,
  key: metric.key,
  name: metric.name,
  resultSemantics: metric.resultSemantics,
  resultContract: metric.resultContract,
}))
const catalog = liveMetrics.map((metric) => ({
  ...metric,
  sourceConnected: true,
}))
const formMetrics: BindingMetric[] = catalog.map((metric) => ({
  ...metric,
  fractionDigits: metric.fractionDigits ?? 2,
  dataStatus: "ready",
}))
function monitorKey(context: ReleaseHealthScope, flagId: string) {
  return [context.projectId, context.envId, flagId].join(":")
}
function seedMonitor(context = currentScope, flagId = flag.id): ServerMonitor {
  const result = {
    flagId,
    enabled: true,
    revision: 1,
    bindings: checkoutMonitor.bindings.map((binding, index) => {
      const metric = liveMetrics.find((item) => item.id === binding.metricId)!
      return {
        ...structuredClone(binding),
        id: "binding-" + index,
        metricVersionId: metric.metricVersionId,
        metricVersion: metric.version,
        revision: 1,
        createdAt: "2026-09-01T00:00:00Z",
        metric,
        sourceConnected: true,
        rules:
          binding.purpose === "guard"
            ? binding.rules.map((rule) => {
                const saved = {
                  ...rule,
                  revision: 1,
                  effectiveAt: "2026-09-01T00:00:00Z",
                }
                delete saved.latestCheck
                return saved
              })
            : null,
      } as ServerBinding
    }),
  }
  monitors.set(monitorKey(context, flagId), result)
  return result
}
function readMonitor(context = currentScope, flagId = flag.id): ServerMonitor {
  return structuredClone(
    monitors.get(monitorKey(context, flagId)) ?? {
      flagId,
      enabled: true,
      revision: 0,
      bindings: [],
    }
  )
}
function saveResponse(
  context: ReleaseHealthScope,
  flagId: string,
  change: (monitor: ServerMonitor) => void
) {
  const next = readMonitor(context, flagId)
  change(next)
  next.revision += 1
  monitors.set(monitorKey(context, flagId), next)
  return structuredClone(next)
}
function hook(id: string, isActive = true, env = "prod") {
  return { id, name: id, url: "https://example.com/hooks/" + id, isActive, env }
}
function setHooks(items: ReturnType<typeof hook>[]) {
  webhookState.items = items
}
function renderMonitor(envId = "prod", selectedFlag = flag, canManage = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return render(
    <FlagReleaseHealthTab
      envId={envId}
      flag={selectedFlag}
      lang="en"
      canManage={canManage}
    />,
    { wrapper }
  )
}
async function setup(envId = "prod", selectedFlag = flag) {
  const view = renderMonitor(envId, selectedFlag)
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add binding" })).toBeEnabled()
  )
  return view
}
function row(name = "Checkout error rate", background = false) {
  if (background)
    return within(
      within(screen.getByRole("table", { hidden: true }))
        .getByText(name)
        .closest("tr")!
    )
  return within(
    within(screen.getByRole("table")).getByRole("row", {
      name: new RegExp(name),
    })
  )
}
async function choose(
  label: string,
  option: RegExp,
  container = screen.getByRole("dialog")
) {
  await waitFor(() =>
    expect(within(container).getByLabelText(label)).toBeEnabled()
  )
  fireEvent.click(within(container).getByLabelText(label))
  const item = await screen.findByRole("option", { name: option })
  fireEvent.keyDown(item, { key: "Enter", code: "Enter" })
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  )
}
async function addTrendBinding() {
  fireEvent.click(screen.getByRole("button", { name: "Add binding" }))
  await choose("Metric", /Crash-free sessions/)
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Add binding",
    })
  )
}
async function removeBinding(name: string) {
  fireEvent.click(
    row(name).getByRole("button", { name: `Remove binding for ${name}` })
  )
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Remove binding",
    })
  )
}
beforeEach(async () => {
  localStorage.clear()
  vi.resetAllMocks()
  monitors.clear()
  Object.assign(scope, {
    userId: "tester",
    workspaceId: "workspace",
    organizationId: "org",
    projectId: "project",
  })
  await i18n.changeLanguage("en")
  setHooks([
    hook("Operations"),
    hook("On call"),
    hook("Disabled", false),
    hook("Other environment", true, "staging"),
  ])
  seedMonitor()
  vi.mocked(monitorApi.get).mockImplementation(async (context, flagId) =>
    readMonitor(context, flagId)
  )
  vi.mocked(monitorApi.metrics).mockResolvedValue(catalog)
  vi.mocked(releaseHealthApi.metrics).mockResolvedValue(liveMetrics)
  vi.mocked(releaseHealthApi.trend).mockImplementation(
    async (_context, id) => ({
      status: "ready",
      queriedAt: "2026-09-01T00:00:00Z",
      resultContract: liveMetrics.find((metric) => metric.id === id)!
        .resultContract,
      points: [{ timestamp: "2026-09-01T00:00:00Z", value: 2 }],
      freshnessSeconds: 0,
    })
  )
  vi.mocked(monitorApi.add).mockImplementation(async (context, flagId, write) =>
    saveResponse(context, flagId, (monitor) => {
      const metric = liveMetrics.find((item) => item.id === write.metricId)!
      monitor.bindings.push({
        id: "added-binding",
        metricId: metric.id,
        metricVersionId: metric.metricVersionId,
        metricVersion: metric.version,
        createdAt: "2026-09-24T00:00:00Z",
        revision: 1,
        enabled: true,
        observationMode: "environment",
        purpose: write.purpose,
        metric,
        sourceConnected: true,
        rules:
          write.purpose === "guard"
            ? (write.rules?.map((rule) => ({
                ...rule,
                revision: 1,
                effectiveAt: "2026-09-24T00:00:00Z",
              })) ?? [])
            : null,
      } as ServerBinding)
    })
  )
  vi.mocked(monitorApi.edit).mockImplementation(
    async (context, flagId, id, write) =>
      saveResponse(context, flagId, (monitor) => {
        monitor.bindings = monitor.bindings.map((binding) =>
          binding.id === id
            ? ({
                ...binding,
                purpose: write.purpose,
                revision: binding.revision + 1,
                rules:
                  write.purpose === "guard"
                    ? (write.rules?.map((rule) => ({
                        ...rule,
                        revision: 1,
                        effectiveAt: "2026-09-24T00:00:00Z",
                      })) ?? [])
                    : null,
              } as ServerBinding)
            : binding
        )
      })
  )
  vi.mocked(monitorApi.remove).mockImplementation(async (context, flagId, id) =>
    saveResponse(context, flagId, (monitor) => {
      monitor.bindings = monitor.bindings.filter((binding) => binding.id !== id)
    })
  )
  vi.mocked(monitorApi.toggleBinding).mockImplementation(
    async (context, flagId, id, write) =>
      saveResponse(context, flagId, (monitor) => {
        monitor.bindings = monitor.bindings.map((binding) =>
          binding.id === id ? { ...binding, enabled: write.enabled } : binding
        )
      })
  )
  vi.mocked(monitorApi.toggle).mockImplementation(
    async (context, flagId, write) =>
      saveResponse(context, flagId, (monitor) => {
        monitor.enabled = write.enabled
      })
  )
})
afterEach(() => {
  focusManager.setFocused(undefined)
  vi.restoreAllMocks()
})

describe("server-persisted monitor bindings", () => {
  it("does not replace a successful save with an older background response", async () => {
    await setup()
    const previous = readMonitor()
    let completeOldRead!: (value: ServerMonitor) => void
    vi.mocked(monitorApi.get).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeOldRead = resolve
        })
    )
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(monitorApi.get).toHaveBeenCalledTimes(2))
    fireEvent.click(
      row().getByRole("button", {
        name: "Pause binding for Checkout error rate",
      })
    )
    await waitFor(() => expect(row().getByText("Paused")).toBeVisible())
    await act(async () => {
      completeOldRead(previous)
    })
    expect(row().getByText("Paused")).toBeVisible()
    expect(
      row().getByRole("button", {
        name: "Resume binding for Checkout error rate",
      })
    ).toBeVisible()
  })

  it("reloads an added binding and a removed old binding from the API without browser storage", async () => {
    const storageRead = vi.spyOn(Storage.prototype, "getItem")
    const storageWrite = vi.spyOn(Storage.prototype, "setItem")
    const view = await setup()
    await addTrendBinding()
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    await removeBinding("Checkout error rate")
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
    view.unmount()
    localStorage.clear()
    await setup()
    expect(row("Crash-free sessions").getByText("Trend")).toBeVisible()
    expect(
      within(screen.getByRole("table")).queryByText("Checkout error rate")
    ).not.toBeInTheDocument()
    expect(screen.getByText("2 Guard · 2 Trend")).toBeVisible()
    expect(monitorApi.get).toHaveBeenCalledTimes(2)
    expect(storageRead).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled()
  })

  it("starts a new monitor empty instead of seeding sample bindings", async () => {
    monitors.clear()
    await setup()
    expect(screen.getByText("0 Guard · 0 Trend")).toBeVisible()
    expect(screen.queryByText("Checkout error rate")).not.toBeInTheDocument()
    expect(monitorApi.add).not.toHaveBeenCalled()
  })

  it("keeps an intentionally empty monitor after all bindings are removed and reloaded", async () => {
    const view = await setup()
    for (const name of [
      "Checkout error rate",
      "API P95 latency",
      "Checkout completion",
      "Service memory saturation",
    ]) {
      await removeBinding(name)
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      )
    }
    view.unmount()
    await setup()
    expect(screen.getByText("0 Guard · 0 Trend")).toBeVisible()
    expect(readMonitor().bindings).toEqual([])
    expect(monitorApi.remove).toHaveBeenCalledTimes(4)
  })

  it("reloads both binding pause and the global monitor switch from the API", async () => {
    const view = await setup()
    fireEvent.click(
      row().getByRole("button", {
        name: "Pause binding for Checkout error rate",
      })
    )
    await waitFor(() => expect(row().getByText("Paused")).toBeVisible())
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Toggle monitoring for all bound metrics",
      })
    )
    await waitFor(() =>
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "false"
      )
    )
    view.unmount()
    await setup()
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false")
    expect(
      row().getByRole("button", {
        name: "Resume binding for Checkout error rate",
      })
    ).toBeVisible()
    fireEvent.click(screen.getByRole("switch"))
    await waitFor(() =>
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
    )
    expect(row().getByText("Paused")).toBeVisible()
    expect(row("API P95 latency").queryByText("Paused")).not.toBeInTheDocument()
  })

  it("reloads the correct monitor when flag, environment, or project changes", async () => {
    const view = await setup()
    await removeBinding("Checkout error rate")
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
    const otherFlag = { ...flag, id: "other-flag" }
    view.rerender(
      <FlagReleaseHealthTab envId="prod" flag={otherFlag} lang="en" />
    )
    await waitFor(() =>
      expect(monitorApi.get).toHaveBeenCalledWith(currentScope, otherFlag.id)
    )
    expect(screen.getByText("0 Guard · 0 Trend")).toBeVisible()
    view.rerender(
      <FlagReleaseHealthTab envId="staging" flag={flag} lang="en" />
    )
    await waitFor(() =>
      expect(monitorApi.get).toHaveBeenCalledWith(
        { projectId: "project", envId: "staging" },
        flag.id
      )
    )
    scope.projectId = "other-project"
    view.rerender(<FlagReleaseHealthTab envId="prod" flag={flag} lang="en" />)
    await waitFor(() =>
      expect(monitorApi.get).toHaveBeenCalledWith(
        { projectId: "other-project", envId: "prod" },
        flag.id
      )
    )
    scope.projectId = "project"
    view.rerender(<FlagReleaseHealthTab envId="prod" flag={flag} lang="en" />)
    await waitFor(() =>
      expect(screen.getByText("2 Guard · 1 Trend")).toBeVisible()
    )
    expect(
      within(screen.getByRole("table")).queryByText("Checkout error rate")
    ).not.toBeInTheDocument()
  })

  it("sends configuration and the expected revision, never client-generated rule checks", async () => {
    await setup()
    fireEvent.click(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    )
    await choose("Webhook", /^Operations$/)
    fireEvent.change(
      within(screen.getByRole("dialog")).getByLabelText(/^Threshold/),
      { target: { value: "7" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Save binding" }))
    await waitFor(() => expect(monitorApi.edit).toHaveBeenCalled())
    const [context, flagId, bindingId, write] = vi.mocked(monitorApi.edit).mock
      .calls[0]
    expect(context).toEqual(currentScope)
    expect(flagId).toBe(flag.id)
    expect(bindingId).toBe("binding-0")
    expect(write).toMatchObject({
      expectedRevision: 1,
      metricId: liveMetrics[0].id,
      metricVersionId: liveMetrics[0].metricVersionId,
      purpose: "guard",
      rules: [
        expect.objectContaining({ threshold: 7, webhookId: "Operations" }),
      ],
    })
    expect(JSON.stringify(write)).not.toMatch(
      /latestCheck|checkedAt|healthStatus|dataStatus/
    )
  })

  it("keeps an add draft when the API returns 500 and saves it on retry", async () => {
    const view = await setup()
    vi.mocked(monitorApi.add).mockRejectedValueOnce(
      new ApiRequestError(500, "Server unavailable")
    )
    await addTrendBinding()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
    expect(
      within(screen.getByRole("dialog")).getByLabelText("Metric")
    ).toHaveTextContent("Crash-free sessions")
    expect(readMonitor().bindings).toHaveLength(4)
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add binding",
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    view.unmount()
    await setup()
    expect(row("Crash-free sessions").getByText("Trend")).toBeVisible()
  })

  it("keeps every edited rule and the current saved monitor after a 409 conflict", async () => {
    await setup()
    fireEvent.click(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    )
    await choose("Webhook", /^Operations$/)
    fireEvent.change(
      within(screen.getByRole("dialog")).getByLabelText(/^Threshold/),
      { target: { value: "7" } }
    )
    vi.mocked(monitorApi.edit).mockRejectedValueOnce(
      new ApiRequestError(409, "Revision conflict")
    )
    fireEvent.click(screen.getByRole("button", { name: "Save binding" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
    expect(
      within(screen.getByRole("dialog")).getByLabelText(/^Threshold/)
    ).toHaveValue(7)
    expect(
      row("Checkout error rate", true).getByText("> 2% for 5 min")
    ).toBeVisible()
    expect(
      row("Checkout error rate", true).queryByText("> 7% for 5 min")
    ).not.toBeInTheDocument()
  })

  it("keeps the binding and removal dialog after a failed delete", async () => {
    await setup()
    vi.mocked(monitorApi.remove).mockRejectedValueOnce(
      new ApiRequestError(500, "Server unavailable")
    )
    await removeBinding("Checkout error rate")
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeVisible()
    expect(
      row("Checkout error rate", true).getByText("Checkout error rate")
    ).toBeVisible()
    expect(readMonitor().bindings).toHaveLength(4)
  })

  it("rolls back binding and monitor toggles when the API rejects writes", async () => {
    await setup()
    vi.mocked(monitorApi.toggleBinding).mockRejectedValueOnce(
      new Error("Server unavailable")
    )
    vi.mocked(monitorApi.toggle).mockRejectedValueOnce(
      new Error("Server unavailable")
    )
    fireEvent.click(
      row().getByRole("button", {
        name: "Pause binding for Checkout error rate",
      })
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(row().queryByText("Paused")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("switch"))
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2))
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("shows a load error and disables writes when the monitor request fails", async () => {
    vi.mocked(monitorApi.get).mockRejectedValue(new Error("Server unavailable"))
    renderMonitor()
    expect(await screen.findByRole("alert")).toBeVisible()
    expect(screen.getByRole("button", { name: "Add binding" })).toBeDisabled()
    expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "true")
    expect(screen.queryByText("Checkout error rate")).not.toBeInTheDocument()
    expect(monitorApi.add).not.toHaveBeenCalled()
  })
})

describe("single metric bindings", () => {
  it("opens the dedicated Release Health creation flow with the current environment", async () => {
    await setup()
    fireEvent.click(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    )
    const link = await screen.findByRole("button", { name: "Create webhook" })
    expect(link).toHaveAttribute(
      "href",
      "/en/webhooks?category=release-health&create=1&context=environment&projectId=project&envId=prod"
    )
    expect(link).toHaveAttribute("target", "_blank")
    await choose("Webhook", /Operations/)
  })
  it("validates Guard fields, filters webhook scope, and keeps edits paused without reusing old checks", async () => {
    await setup()
    fireEvent.click(
      row().getByRole("button", {
        name: "Pause binding for Checkout error rate",
      })
    )
    await waitFor(() => expect(row().getByText("Paused")).toBeVisible())
    fireEvent.click(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    )
    const dialog = within(await screen.findByRole("dialog"))
    expect(dialog.getByLabelText("Metric")).toBeDisabled()
    await waitFor(() =>
      expect(dialog.getByRole("button", { name: "Save binding" })).toBeEnabled()
    )
    fireEvent.change(dialog.getByLabelText(/^Threshold/), {
      target: { value: "" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Save binding" }))
    expect(await dialog.findByText("Enter a finite threshold.")).toBeVisible()
    expect(
      dialog.getByText("Select a webhook for this alert rule.")
    ).toBeVisible()
    fireEvent.change(dialog.getByLabelText(/^Threshold/), {
      target: { value: "3" },
    })
    fireEvent.click(dialog.getByLabelText("Webhook"))
    expect(
      await screen.findByRole("option", { name: "Operations" })
    ).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "Disabled" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: "Other environment" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("option", { name: "Operations" }))
    fireEvent.click(dialog.getByRole("button", { name: "Save binding" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(row().getByText("Paused")).toBeVisible()
    expect(row().getByText("> 3% for 5 min")).toBeVisible()
    expect(row().getByText("Webhook: Operations")).toBeVisible()
    expect(row().getByText("Not checked yet")).toBeVisible()
    expect(row().queryByText("Critical")).not.toBeInTheDocument()
  })

  it("rejects a webhook that becomes unavailable at save time", async () => {
    await setup()
    fireEvent.click(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    )
    await choose("Webhook", /Operations/)
    setHooks([hook("Operations", false)])
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Save binding",
      })
    )
    expect(await screen.findByText(/This webhook is unavailable/)).toBeVisible()
    expect(
      within(screen.getByRole("dialog")).getByLabelText(/^Threshold/)
    ).toHaveValue(2)
  })

  it("clears Guard configuration on switching to Trend and permits rebinding only after removal", async () => {
    await setup()
    fireEvent.click(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    )
    const dialog = within(await screen.findByRole("dialog"))
    fireEvent.click(dialog.getByRole("radio", { name: /^Trend/ }))
    expect(dialog.queryByLabelText("Webhook")).not.toBeInTheDocument()
    fireEvent.click(dialog.getByRole("button", { name: "Save binding" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(screen.getByText("2 Guard · 2 Trend")).toBeVisible()
    expect(row().getByText("Not applicable")).toBeVisible()
    fireEvent.click(
      row().getByRole("button", {
        name: "Pause binding for Checkout error rate",
      })
    )
    await waitFor(() => expect(row().getByText("Paused")).toBeVisible())
    fireEvent.click(screen.getByRole("button", { name: "Add binding" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByLabelText("Metric"))
    expect(
      screen.queryByRole("option", { name: /Checkout error rate/ })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" })
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    fireEvent.click(
      row().getByRole("button", {
        name: "Remove binding for Checkout error rate",
      })
    )
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Remove binding",
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
    expect(
      within(screen.getByRole("table")).queryByRole("row", {
        name: /Checkout error rate/,
      })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Add binding" }))
    await choose("Metric", /Checkout error rate/)
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add binding",
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(row().getByText("Not applicable")).toBeVisible()
  })

  it("closes drafts when the environment changes and disables edits for read-only users", async () => {
    seedMonitor({ projectId: "project", envId: "staging" })
    const view = await setup()
    fireEvent.click(screen.getByRole("button", { name: "Add binding" }))
    await choose("Metric", /Crash-free sessions/)
    view.rerender(
      <FlagReleaseHealthTab
        envId="staging"
        flag={flag}
        lang="en"
        canManage={false}
      />
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add binding" })).toBeDisabled()
    await waitFor(() =>
      expect(
        row().getByRole("button", {
          name: "Edit binding for Checkout error rate",
        })
      ).toBeDisabled()
    )
  })
})

it("validates numeric ranges and drops Guard-only fields when saving Trend", () => {
  const existing = checkoutMonitor.bindings[0]
  const values = bindingDefaults(existing)
  values.rules[0].webhookId = "Operations"
  const schema = bindingSchema(i18n.t, formMetrics, [existing.metricId])
  const threshold = (value: string) => ({
    ...values,
    rules: [{ ...values.rules[0], threshold: value }],
  })
  expect(schema.safeParse(threshold("Infinity")).success).toBe(false)
  expect(schema.safeParse(threshold("101")).success).toBe(false)
  expect(schema.safeParse(threshold("0")).success).toBe(true)
  const trend = bindingFromForm(
    { ...values, purpose: "trend" },
    { ...existing, enabled: false }
  )
  expect(trend).toEqual({
    metricId: existing.metricId,
    observationMode: "environment",
    purpose: "trend",
    enabled: false,
  })
})

describe("multiple alert rules", () => {
  async function editWithSecondRule() {
    await setup()
    fireEvent.click(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    )
    await choose("Webhook", /^Operations$/)
    fireEvent.click(screen.getByRole("button", { name: "Add alert rule" }))
    return screen.getByRole("group", { name: "Alert rule 2" })
  }

  it("validates each rule and saves independent thresholds, severity and webhooks", async () => {
    const second = await editWithSecondRule()
    fireEvent.click(screen.getByRole("button", { name: "Save binding" }))
    expect(
      await within(second).findByText("Enter a finite threshold.")
    ).toBeVisible()
    expect(
      within(second).getByText("Select a webhook for this alert rule.")
    ).toBeVisible()
    const first = within(screen.getByRole("group", { name: "Alert rule 1" }))
    expect(first.queryByRole("alert")).not.toBeInTheDocument()
    fireEvent.change(within(second).getByLabelText("Rule name"), {
      target: { value: "Error rate warning" },
    })
    fireEvent.change(within(second).getByLabelText(/^Threshold/), {
      target: { value: "1" },
    })
    await choose("Alert level", /^Warning$/, second)
    await choose("Webhook", /^On call$/, second)
    expect(within(second).getByLabelText("Webhook")).toHaveTextContent(
      "On call"
    )
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save binding" })).toBeEnabled()
    )
    fireEvent.click(screen.getByRole("button", { name: "Save binding" }))
    await waitFor(() => {
      const dialog = screen.queryByRole("dialog")
      expect(
        dialog
          ? within(dialog)
              .queryAllByRole("alert")
              .map((node) => node.textContent)
          : []
      ).toEqual([])
      expect(dialog).not.toBeInTheDocument()
    })
    expect(row().getByText("Webhook: Operations")).toBeVisible()
    expect(row().getByText("Webhook: On call")).toBeVisible()
    expect(row().getByText("> 1% for 5 min")).toBeVisible()
    expect(row().getByText("> 2% for 5 min")).toBeVisible()
    expect(row().getAllByText("Not evaluated")).toHaveLength(2)
    expect(row().getAllByText("Not checked yet")).toHaveLength(2)
    cleanup()
    await setup()
    expect(await row().findByText("Webhook: Operations")).toBeVisible()
    expect(row().getByText("Webhook: On call")).toBeVisible()
    expect(row().getByText("> 1% for 5 min")).toBeVisible()
    expect(row().getByText("> 2% for 5 min")).toBeVisible()
    fireEvent.click(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    )
    const reopened = within(screen.getByRole("group", { name: "Alert rule 2" }))
    expect(reopened.getByLabelText("Rule name")).toHaveValue(
      "Error rate warning"
    )
    expect(reopened.getByLabelText("Webhook")).toHaveTextContent("On call")
  })

  it("rechecks every webhook at save time and preserves all drafts if one destination becomes unavailable", async () => {
    const second = await editWithSecondRule()
    fireEvent.change(within(second).getByLabelText(/^Threshold/), {
      target: { value: "4" },
    })
    await choose("Webhook", /^On call$/, second)
    expect(within(second).getByLabelText("Webhook")).toHaveTextContent(
      "On call"
    )
    setHooks([hook("Operations"), hook("On call", false)])
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save binding" })).toBeEnabled()
    )
    fireEvent.click(screen.getByRole("button", { name: "Save binding" }))
    expect(
      await within(second).findByText(/This webhook is unavailable/)
    ).toBeVisible()
    expect(within(second).getByLabelText(/^Threshold/)).toHaveValue(4)
    expect(
      within(
        screen.getByRole("group", { name: "Alert rule 1" })
      ).getByLabelText(/^Threshold/)
    ).toHaveValue(2)
    expect(
      within(screen.getByRole("group", { name: "Alert rule 1" })).queryByRole(
        "alert"
      )
    ).not.toBeInTheDocument()
  })

  it("can remove a rule without clearing the other rule and keeps at least one", async () => {
    const second = await editWithSecondRule()
    fireEvent.change(within(second).getByLabelText(/^Threshold/), {
      target: { value: "4" },
    })
    await choose("Webhook", /^Operations$/, second)
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove alert rule Error rate critical",
      })
    )
    expect(
      screen.getByRole("button", { name: "Remove alert rule Alert rule 2" })
    ).toBeDisabled()
    expect(
      within(screen.getByRole("dialog")).getByLabelText(/^Threshold/)
    ).toHaveValue(4)
    fireEvent.click(screen.getByRole("button", { name: "Save binding" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(row().getByText("> 4% for 5 min")).toBeVisible()
    expect(row().queryByText("> 2% for 5 min")).not.toBeInTheDocument()
    expect(row().getByText("Not checked yet")).toBeVisible()
  })

  it("allows saving Trend after an incomplete extra rule and discards all Guard configuration", async () => {
    await editWithSecondRule()
    fireEvent.click(screen.getByRole("radio", { name: /^Trend/ }))
    fireEvent.click(screen.getByRole("button", { name: "Save binding" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(row().getByText("Not applicable")).toBeVisible()
    fireEvent.click(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    )
    fireEvent.click(screen.getByRole("radio", { name: /^Guard/ }))
    expect(screen.getByRole("group", { name: "Alert rule 1" })).toBeVisible()
    expect(
      screen.queryByRole("group", { name: "Alert rule 2" })
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByRole("dialog")).getByLabelText(/^Threshold/)
    ).toHaveValue(null)
  })

  it("preserves evidence by stable rule identity and only invalidates changed evaluation conditions", () => {
    const binding = checkoutMonitor.bindings[0]
    if (binding.purpose !== "guard") throw new Error("Expected Guard fixture")
    const first = binding.rules[0]
    const second = {
      ...first,
      id: "second",
      name: "Second rule",
      webhookId: "On call",
      threshold: 3,
    }
    const previous: MonitorBinding = { ...binding, rules: [first, second] }
    const values = bindingDefaults(previous)
    values.rules[0].threshold = "5"
    values.rules[1].name = "Renamed rule"
    values.rules[1].webhookId = "Operations"
    const next = bindingFromForm(values, previous)
    if (next.purpose !== "guard") throw new Error("Expected Guard result")
    expect(next.rules[0].latestCheck).toBeUndefined()
    expect(next.rules[1].latestCheck).toEqual(second.latestCheck)
    const removed = bindingFromForm(
      { ...values, rules: [values.rules[1]] },
      previous
    )
    if (removed.purpose !== "guard") throw new Error("Expected Guard result")
    expect(removed.rules[0].id).toBe("second")
    expect(removed.rules[0].latestCheck).toEqual(second.latestCheck)
  })

  it("requires a rule, rejects ambiguous names and identities, and allows a shared webhook", () => {
    const binding = checkoutMonitor.bindings[0]
    const values = bindingDefaults(binding)
    values.rules[0].webhookId = "Operations"
    values.rules.push({
      ...newAlertRule("Second rule"),
      threshold: "3",
      webhookId: "Operations",
    })
    const schema = bindingSchema(i18n.t, formMetrics, [binding.metricId])
    expect(schema.safeParse(values).success).toBe(true)
    expect(schema.safeParse({ ...values, rules: [] }).success).toBe(false)
    values.rules[1].id = values.rules[0].id
    expect(schema.safeParse(values).success).toBe(false)
    values.rules[1].id = "other"
    values.rules[1].name = " " + values.rules[0].name.toUpperCase() + " "
    expect(schema.safeParse(values).success).toBe(false)
  })
})
