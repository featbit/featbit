import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FeatureFlag } from "@/features/flags/flags-types"
import {
  previewStoreKey,
  type ReleaseHealthWebhook,
} from "@/features/webhooks/release-health/preview-store"
import { ALERT_PAYLOAD_TEMPLATE } from "@/features/webhooks/release-health/alert-payload"

import { i18n } from "@/lib/i18n/i18n"
import { FlagReleaseHealthTab } from "./flag-release-health-tab"
import {
  bindingDefaults,
  bindingFromForm,
  bindingSchema,
  newAlertRule,
} from "./binding-form"
import type { MonitorBinding } from "../release-health-types"
import { checkoutMonitor, releaseMetrics } from "../release-health-mock-data"

vi.mock("@/features/auth/auth-api", async (original) => ({
  ...(await original<typeof import("@/features/auth/auth-api")>()),
  getStoredUserProfile: () => ({ id: "tester" }),
}))
vi.mock("@/features/layout/layout-context", async (original) => ({
  ...(await original<typeof import("@/features/layout/layout-context")>()),
  getCurrentWorkspace: () => ({ id: "workspace" }),
  getCurrentOrganization: () => ({ id: "org" }),
  getCurrentProjectEnv: () => ({
    projectId: "project",
    envId: "prod",
    envName: "Production",
  }),
}))
const flag = { id: "flag", key: "checkout", name: "Checkout" } as FeatureFlag
function hook(id: string, isActive = true, env = "prod") {
  return {
    id,
    name: id,
    url: "https://example.com/hooks/" + id,
    isActive,
    scopes: ["project/" + env],
    purpose: "release-health",
    scopeNames: ["Project/" + env],
    payloadTemplateType: "default",
    payloadTemplate: ALERT_PAYLOAD_TEMPLATE,
    headers: [],
    secret: "",
  } satisfies ReleaseHealthWebhook
}
function setHooks(items: ReleaseHealthWebhook[]) {
  localStorage.setItem(previewStoreKey()!, JSON.stringify(items))
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return render(<FlagReleaseHealthTab envId="prod" flag={flag} lang="en" />, {
    wrapper,
  })
}
function row(name = "Checkout error rate") {
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
beforeEach(async () => {
  await i18n.changeLanguage("en")
  setHooks([
    hook("Operations"),
    hook("On call"),
    hook("Disabled", false),
    hook("Other environment", true, "staging"),
  ])
})

describe("single metric bindings", () => {
  it("opens the dedicated Release Health creation flow with the current environment", async () => {
    setup()
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
    setup()
    fireEvent.click(
      row().getByRole("button", {
        name: "Pause binding for Checkout error rate",
      })
    )
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
    setup()
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
    setup()
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
    fireEvent.click(screen.getByRole("button", { name: "Add binding" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByLabelText("Metric"))
    expect(
      screen.queryByRole("option", { name: /Checkout error rate/ })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" })
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })
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
    const view = setup()
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
    expect(
      row().getByRole("button", {
        name: "Edit binding for Checkout error rate",
      })
    ).toBeDisabled()
  })
})

it("validates numeric ranges and drops Guard-only fields when saving Trend", () => {
  const existing = checkoutMonitor.bindings[0]
  const values = bindingDefaults(existing)
  values.rules[0].webhookId = "Operations"
  const schema = bindingSchema(i18n.t, releaseMetrics, [existing.metricId])
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
    setup()
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
    expect(row().getByText("Critical")).toBeVisible()
    expect(row().getByText("Not checked yet")).toBeVisible()
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
    const schema = bindingSchema(i18n.t, releaseMetrics, [binding.metricId])
    expect(schema.safeParse(values).success).toBe(true)
    expect(schema.safeParse({ ...values, rules: [] }).success).toBe(false)
    values.rules[1].id = values.rules[0].id
    expect(schema.safeParse(values).success).toBe(false)
    values.rules[1].id = "other"
    values.rules[1].name = " " + values.rules[0].name.toUpperCase() + " "
    expect(schema.safeParse(values).success).toBe(false)
  })
})
