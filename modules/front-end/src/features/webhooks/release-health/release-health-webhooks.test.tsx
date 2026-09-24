import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi, ApiRequestError } from "@/lib/api/authenticated-api"
import { i18n } from "@/lib/i18n/i18n"
import { webhookHeadersSchema } from "./webhook-authentication"
import { WebhooksPage } from "../webhooks-page"
import { createWebhook, sendTestWebhook } from "../webhooks-api"
import {
  ALERT_PAYLOAD_TEMPLATE,
  ALERT_TEMPLATE_VARIABLES,
  alertPayloadSample,
  renderAlertPayload,
  validateAlertTemplate,
} from "./alert-payload"
import {
  availableAlertWebhooks,
  previewStoreKey,
  fetchReleaseHealthWebhooks,
  removeReleaseHealthWebhook,
  saveReleaseHealthWebhook,
  useReleaseHealthWebhooks,
  type ReleaseHealthWebhookDraft,
  type ReleaseHealthWebhook,
} from "./preview-store"

vi.mock("@/lib/api/authenticated-api", async (original) => ({
  ...(await original<typeof import("@/lib/api/authenticated-api")>()),
  fetchApi: vi.fn(),
}))
const catalogues = new Map<string, ReleaseHealthWebhook[]>()
const serverItems = () => catalogues.get(identity.org) ?? []
function installServer() {
  vi.mocked(fetchApi).mockImplementation(async (path, init) => {
    const items = serverItems()
    if (!init?.method || init.method === "GET") return structuredClone(items)
    const id = path.split("/").at(-1)!.split("?")[0]
    const previous = items.find((item) => item.id === id)
    if (init.method === "DELETE") {
      if (
        Number(
          new URLSearchParams(path.split("?")[1]).get("expectedVersion")
        ) !== previous?.version
      )
        throw new ApiRequestError(409, "Conflict")
      catalogues.set(
        identity.org,
        items.filter((item) => item.id !== id)
      )
      return true
    }
    const write = JSON.parse(String(init.body)) as ReleaseHealthWebhook & {
      expectedVersion: number | null
      headersUpdate: { operation: string; headers?: unknown[] }
      secretUpdate: { operation: string; secret?: string }
    }
    if (init.method === "PUT" && write.expectedVersion !== previous?.version)
      throw new ApiRequestError(409, "Conflict")
    const item: ReleaseHealthWebhook = {
      id: previous?.id ?? crypto.randomUUID(),
      purpose: "release-health",
      name: write.name,
      url: write.url,
      isActive: write.isActive,
      scopes: write.scopes,
      scopeNames: write.scopes.flatMap((scope) => {
        const [pid, ids] = scope.split("/")
        return ids
          .split(",")
          .map(
            (env) =>
              `${pid === "project" ? "Storefront" : "API"}/${env === "dev" ? "Development" : "Production"}`
          )
      }),
      payloadTemplate: write.payloadTemplate,
      payloadTemplateType: write.payloadTemplateType,
      version: (previous?.version ?? 0) + 1,
      canManage: true,
      hasHeaders:
        write.headersUpdate.operation === "keep"
          ? (previous?.hasHeaders ?? false)
          : write.headersUpdate.operation === "replace" &&
            Boolean(write.headersUpdate.headers?.length),
      hasSecret:
        write.secretUpdate.operation === "keep"
          ? (previous?.hasSecret ?? false)
          : write.secretUpdate.operation === "replace" &&
            Boolean(write.secretUpdate.secret),
      headers: [],
      secret: "",
    }
    catalogues.set(
      identity.org,
      previous
        ? items.map((row) => (row.id === id ? item : row))
        : [...items, item]
    )
    return structuredClone(item)
  })
}

const identity = vi.hoisted(() => ({
  user: "tester",
  workspace: "workspace",
  org: "org",
}))
vi.mock("@/features/auth/auth-api", async (original) => ({
  ...(await original<typeof import("@/features/auth/auth-api")>()),
  getStoredUserProfile: () => ({ id: identity.user }),
}))
vi.mock("@/features/layout/layout-context", async (original) => ({
  ...(await original<typeof import("@/features/layout/layout-context")>()),
  getCurrentWorkspace: () => ({ id: identity.workspace }),
  getCurrentOrganization: () => ({ id: identity.org }),
  getCurrentProjectEnv: () => ({
    projectId: "project",
    envId: "prod",
    projectName: "Storefront",
    envName: "Production",
  }),
}))
vi.mock("../webhooks-api", async (original) => ({
  ...(await original<typeof import("../webhooks-api")>()),
  createWebhook: vi.fn(),
  sendTestWebhook: vi.fn(),
  fetchWebhooks: vi.fn(async () => ({ totalCount: 0, items: [] })),
  fetchWebhookProjects: vi.fn(async () => [
    {
      id: "project",
      key: "storefront",
      name: "Storefront",
      environments: [
        { id: "prod", name: "Production" },
        { id: "dev", name: "Development" },
      ],
    },
    {
      id: "other",
      key: "api",
      name: "API",
      environments: [{ id: "other-prod", name: "Production" }],
    },
  ]),
  fetchWebhookEnvironmentResources: vi.fn(async () => [
    {
      id: "prod",
      name: "Production",
      pathName: "Storefront/Production",
      rn: "project/storefront:env/prod",
      type: "env",
    },
    {
      id: "dev",
      name: "Development",
      pathName: "Storefront/Development",
      rn: "project/storefront:env/dev",
      type: "env",
    },
    {
      id: "other-prod",
      name: "Production",
      pathName: "API/Production",
      rn: "project/api:env/prod",
      type: "env",
    },
  ]),
  isWebhookNameUsed: vi.fn(async () => false),
}))
vi.mock("../components/code-mirror-template-editor", () => ({
  CodeMirrorTemplateEditor: ({
    value,
    onChange,
    readOnly,
  }: {
    value: string
    onChange: (value: string) => void
    readOnly: boolean
  }) => (
    <textarea
      aria-label="Payload template editor"
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

function draft(name = "Operations"): ReleaseHealthWebhookDraft {
  return {
    name,
    url: "https://example.com/alerts",
    isActive: true,
    scopes: ["project/prod", "other/other-prod"],
    scopeNames: ["Storefront/Production", "API/Production"],
    payloadTemplateType: "default",
    payloadTemplate: ALERT_PAYLOAD_TEMPLATE,
  }
}
function provider(entry = "/en/webhooks?category=release-health&create=1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}
beforeEach(async () => {
  localStorage.clear()
  vi.clearAllMocks()
  catalogues.clear()
  installServer()
  identity.org = "org"
  identity.user = "tester"
  identity.workspace = "workspace"
  await i18n.changeLanguage("en")
})

describe("Release Health webhook payloads", () => {
  it("renders trigger and recovery from the same alert cycle with typed evidence and no resource-change fields", () => {
    const trigger = JSON.parse(
      renderAlertPayload(ALERT_PAYLOAD_TEMPLATE, "alert.triggered")
    )
    const recovery = JSON.parse(
      renderAlertPayload(ALERT_PAYLOAD_TEMPLATE, "alert.recovered")
    )
    expect(trigger.event.type).toBe("alert.triggered")
    expect(recovery.event.type).toBe("alert.recovered")
    expect(trigger.event.id).not.toBe(recovery.event.id)
    expect(trigger.alert.id).toBe(recovery.alert.id)
    expect(trigger.alert.recoveredAt).toBeNull()
    expect(recovery.alert.recoveredAt).toBe(recovery.evaluation.checkedAt)
    expect(trigger.evaluation.value).toBe(2.6)
    expect(recovery.evaluation.value).toBe(0.8)
    expect(trigger.metric.version).toBe(3)
    expect(trigger).not.toHaveProperty("operator")
    expect(trigger).not.toHaveProperty("changes")
    expect(trigger).not.toHaveProperty("data")
    expect(trigger).toEqual(alertPayloadSample("alert.triggered"))
    expect(recovery).toEqual(alertPayloadSample("alert.recovered"))
    expect(ALERT_PAYLOAD_TEMPLATE).not.toContain("{{json ")
    expect(ALERT_PAYLOAD_TEMPLATE).toContain('"name": "{{metric.name}}"')
  })
  it("validates both branches and rejects resource-change variables and non-object payloads", () => {
    const template =
      '{{#if (eq event.type "alert.recovered")}}invalid{{else}}{"value": {{evaluation.value}} }{{/if}}'
    expect(validateAlertTemplate(template)).toContain("alert.recovered")
    expect(validateAlertTemplate('{"operator": "{{operator}}"}')).toContain(
      "operator"
    )
    expect(validateAlertTemplate("[]")).not.toBeNull()
    expect(
      validateAlertTemplate(
        '{"type": "{{event.type}}", "recoveredAt": {{alert.recoveredAt}} }'
      )
    ).toBeNull()
    expect(
      JSON.parse(
        renderAlertPayload(
          '{"evaluation": {{json evaluation}} }',
          "alert.triggered"
        )
      ).evaluation
    ).toEqual(alertPayloadSample("alert.triggered").evaluation)
  })
})

describe("server destination lifecycle", () => {
  it("reads server state after remount without reading or uploading legacy browser data", async () => {
    localStorage.setItem(
      "featbit:release-health-webhooks-preview:v1:tester:workspace:org",
      JSON.stringify([{ ...draft("Old local"), secret: "local-sensitive" }])
    )
    const saved = await saveReleaseHealthWebhook(previewStoreKey()!, draft())
    const first = renderHook(() => useReleaseHealthWebhooks(), {
      wrapper: provider(),
    })
    await waitFor(() =>
      expect(first.result.current.data?.[0].id).toBe(saved.id)
    )
    first.unmount()
    const second = renderHook(() => useReleaseHealthWebhooks(), {
      wrapper: provider(),
    })
    await waitFor(() =>
      expect(second.result.current.data?.[0].id).toBe(saved.id)
    )
    expect(JSON.stringify(vi.mocked(fetchApi).mock.calls)).not.toContain(
      "local-sensitive"
    )
  })
  it("persists credential update operations but never returns them or writes browser storage", async () => {
    const owner = previewStoreKey()!
    const saved = await saveReleaseHealthWebhook(owner, {
      ...draft(),
      headers: [{ key: "Authorization", value: "secret-token" }],
      secret: "signing-token",
    })
    expect(saved).toMatchObject({
      hasHeaders: true,
      hasSecret: true,
      headers: [],
      secret: "",
    })
    expect(localStorage.length).toBe(0)
    const kept = await saveReleaseHealthWebhook(owner, draft(), saved)
    expect(
      JSON.parse(String(vi.mocked(fetchApi).mock.calls.at(-1)?.[1]?.body))
    ).toMatchObject({
      expectedVersion: 1,
      headersUpdate: { operation: "keep" },
      secretUpdate: { operation: "keep" },
    })
    expect(kept).toMatchObject({ hasHeaders: true, hasSecret: true })
    const cleared = await saveReleaseHealthWebhook(
      owner,
      { ...draft(), removeSavedHeaders: true, removeSavedSecret: true },
      kept
    )
    expect(cleared).toMatchObject({ hasHeaders: false, hasSecret: false })
  })
  it("filters exact scopes, reads a fresh organization and rejects stale mutations", async () => {
    const owner = previewStoreKey()!
    const saved = await saveReleaseHealthWebhook(owner, draft())
    expect(availableAlertWebhooks([saved], "project", "prod")).toHaveLength(1)
    expect(availableAlertWebhooks([saved], "project", "pro")).toEqual([])
    const changed = await saveReleaseHealthWebhook(
      owner,
      { ...draft(), isActive: false },
      saved
    )
    expect(availableAlertWebhooks([changed], "project", "prod")).toEqual([])
    await expect(
      saveReleaseHealthWebhook(owner, draft(), saved)
    ).rejects.toMatchObject({ status: 409 })
    await removeReleaseHealthWebhook(owner, changed)
    expect(await fetchReleaseHealthWebhooks()).toEqual([])
    identity.org = "other"
    await expect(saveReleaseHealthWebhook(owner, draft())).rejects.toThrow(
      "missing-context"
    )
    expect(await fetchReleaseHealthWebhooks()).toEqual([])
  })
  it("refetches server changes on return from another tab and exposes load failures", async () => {
    const { result } = renderHook(() => useReleaseHealthWebhooks(), {
      wrapper: provider(),
    })
    await waitFor(() => expect(result.current.data).toEqual([]))
    const saved = await saveReleaseHealthWebhook(previewStoreKey()!, draft())
    fireEvent(window, new Event("focus"))
    await waitFor(() => expect(result.current.data?.[0].id).toBe(saved.id))
    vi.mocked(fetchApi).mockRejectedValue(new Error("offline"))
    const failed = await result.current.refetch()
    expect(failed.isError).toBe(true)
  })
})

describe("Release Health webhook UI", () => {
  it("keeps field definitions static and selects result profiles and severities only in the payload preview", async () => {
    render(<WebhooksPage />, { wrapper: provider() })
    const dialog = within(
      await screen.findByRole("dialog", { name: "New Release Health webhook" })
    )
    expect(
      dialog.getByRole("heading", { name: "Supported events" })
    ).toBeVisible()
    fireEvent.click(dialog.getByText("When no event is sent"))
    expect(dialog.getByText("NoData")).toBeVisible()
    expect(dialog.getByText("Invalid result")).toBeVisible()
    fireEvent.click(dialog.getByText("Supported result contracts · 9 profiles"))
    expect(dialog.getByText(/Rate supports all 18 combinations/)).toBeVisible()
    const choose = async (
      scope: ReturnType<typeof within>,
      label: string,
      name: string
    ) => {
      fireEvent.click(scope.getByRole("combobox", { name: label }))
      fireEvent.keyDown(await screen.findByRole("option", { name }), {
        key: "Enter",
        code: "Enter",
      })
      await waitFor(() =>
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      )
    }
    expect(
      dialog.queryByRole("combobox", { name: "Sample result profile" })
    ).not.toBeInTheDocument()
    expect(
      dialog.queryByRole("combobox", { name: "Sample rule severity" })
    ).not.toBeInTheDocument()
    expect(
      dialog.queryByRole("columnheader", { name: "Triggered example" })
    ).not.toBeInTheDocument()
    expect(
      dialog.getByRole("columnheader", { name: "Allowed values / description" })
    ).toBeVisible()
    await choose(dialog, "Variable group", "metric.resultContract.unit")
    expect(dialog.getByText("{{metric.resultContract.unit.per}}")).toBeVisible()
    fireEvent.click(dialog.getByRole("button", { name: "Preview payload" }))
    const preview = within(
      await screen.findByRole("dialog", { name: "Alert payload preview" })
    )
    await choose(preview, "Sample result profile", "Rate · structured rate")
    await choose(preview, "Rate numerator", "bytes")
    await choose(preview, "Rate period", "hour")
    await choose(preview, "Sample rule severity", "Warning")
    const read = () =>
      JSON.parse(preview.getByLabelText("Rendered alert payload").textContent!)
    expect(read().metric.resultContract.unit).toMatchObject({
      kind: "rate",
      numerator: "bytes",
      per: "hour",
      scale: null,
      base: null,
    })
    expect(read().evaluation.healthStatus).toBe("warning")
    fireEvent.click(preview.getByRole("tab", { name: "Alert recovered" }))
    expect(read().evaluation.healthStatus).toBe("healthy")
    expect(read().event.type).toBe("alert.recovered")
    await choose(preview, "Sample result profile", "Gauge · millisecond")
    expect(
      preview.queryByRole("combobox", { name: "Rate numerator" })
    ).not.toBeInTheDocument()
    expect(read().metric.resultContract.unit).toMatchObject({
      kind: "duration",
      base: "millisecond",
      numerator: null,
      per: null,
    })
    expect(read().evaluation.value).toBe(650.375)
    fireEvent.click(preview.getByRole("button", { name: "Close" }))
    expect(
      dialog.getByRole("combobox", { name: "Variable group" })
    ).toHaveTextContent("metric.resultContract.unit")
    expect(
      dialog.queryByRole("combobox", { name: "Sample result profile" })
    ).not.toBeInTheDocument()
    expect(dialog.getByLabelText("Payload template editor")).toHaveValue(
      ALERT_PAYLOAD_TEMPLATE
    )
    expect(sendTestWebhook).not.toHaveBeenCalled()
  })
  it("matches field definitions to the template and keeps custom edits when switching modes", async () => {
    render(<WebhooksPage />, { wrapper: provider() })
    const dialog = within(
      await screen.findByRole("dialog", { name: "New Release Health webhook" })
    )
    const editor = dialog.getByLabelText("Payload template editor")
    expect(editor).toHaveValue(ALERT_PAYLOAD_TEMPLATE)
    expect(editor).toHaveAttribute("readonly")
    const chooseGroup = async (name: string) => {
      fireEvent.click(dialog.getByRole("combobox", { name: "Variable group" }))
      fireEvent.keyDown(await screen.findByRole("option", { name }), {
        key: "Enter",
        code: "Enter",
      })
      await waitFor(() =>
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      )
    }
    await chooseGroup("evaluation")
    const reference = within(
      dialog.getByRole("table", { name: "Available template variables" })
    )
    const value = reference.getByRole("row", {
      name: /\{\{evaluation.value\}\}/,
    })
    expect(value).toHaveTextContent("number")
    expect(value).not.toHaveTextContent("2.6")
    expect(value).not.toHaveTextContent("0.8")
    expect(ALERT_PAYLOAD_TEMPLATE).toContain('"value": {{evaluation.value}}')
    expect(ALERT_TEMPLATE_VARIABLES).toContain("evaluation.value")
    expect(dialog.getByText("{{evaluation}}")).toBeVisible()
    await chooseGroup("alert")
    const recovered = reference.getByRole("row", {
      name: /\{\{alert.recoveredAt\}\}/,
    })
    expect(recovered).toHaveTextContent("string | null")
    expect(recovered).not.toHaveTextContent("2026-09-17T02:20:00Z")
    fireEvent.click(dialog.getByRole("radio", { name: "Custom" }))
    const custom = '{"value": {{evaluation.value}} }'
    fireEvent.change(editor, { target: { value: custom } })
    fireEvent.click(dialog.getByRole("radio", { name: "Default" }))
    expect(editor).toHaveValue(ALERT_PAYLOAD_TEMPLATE)
    fireEvent.click(dialog.getByRole("radio", { name: "Custom" }))
    expect(editor).toHaveValue(custom)
  })
  it("combines project, environment and name filters and clears the environment when the project changes", async () => {
    const key = previewStoreKey()!
    await saveReleaseHealthWebhook(key, draft("Shared production"))
    await saveReleaseHealthWebhook(key, {
      ...draft("Storefront development"),
      scopes: ["project/dev"],
      scopeNames: ["Storefront/Development"],
    })
    await saveReleaseHealthWebhook(key, {
      ...draft("API production"),
      scopes: ["other/other-prod"],
      scopeNames: ["API/Production"],
    })
    render(<WebhooksPage />, {
      wrapper: provider("/en/webhooks?category=release-health"),
    })
    const choose = async (label: string, option: string) => {
      fireEvent.click(screen.getByRole("combobox", { name: label }))
      const item = await screen.findByRole("option", {
        name: option,
      })
      fireEvent.keyDown(item, { key: "Enter", code: "Enter" })
      await waitFor(() =>
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      )
    }
    const listed = (name: string) => screen.queryByRole("button", { name })
    await screen.findByRole("button", {
      name: "Shared production",
    })
    expect(screen.getByRole("combobox", { name: "Environment" })).toBeDisabled()
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Project" })).toBeEnabled()
    )
    await choose("Project", "Storefront")
    expect(listed("Shared production")).toBeVisible()
    expect(listed("Storefront development")).toBeVisible()
    expect(listed("API production")).not.toBeInTheDocument()
    await choose("Environment", "Production")
    expect(listed("Shared production")).toBeVisible()
    expect(listed("Storefront development")).not.toBeInTheDocument()
    await choose("Environment", "Development")
    expect(listed("Storefront development")).toBeVisible()
    expect(listed("Shared production")).not.toBeInTheDocument()
    await choose("Project", "API")
    expect(
      screen.getByRole("combobox", { name: "Environment" })
    ).toHaveTextContent("All environments")
    fireEvent.click(screen.getByRole("combobox", { name: "Environment" }))
    expect(
      await screen.findByRole("option", { name: "Production" })
    ).toBeVisible()
    expect(
      screen.queryByRole("option", { name: "Development" })
    ).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("option", { name: "Production" }), {
      key: "Enter",
      code: "Enter",
    })
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    )
    expect(listed("Shared production")).toBeVisible()
    expect(listed("API production")).toBeVisible()
    fireEvent.change(screen.getByRole("textbox", { name: "Filter by name" }), {
      target: { value: "Storefront" },
    })
    expect(screen.getByText("No webhooks match these filters.")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveTextContent(
      "All projects"
    )
    expect(screen.getByRole("combobox", { name: "Environment" })).toBeDisabled()
    expect(
      screen.getByRole("combobox", { name: "Environment" })
    ).toHaveTextContent("All environments")
    expect(listed("Shared production")).toBeVisible()
    expect(listed("Storefront development")).toBeVisible()
    expect(listed("API production")).toBeVisible()
  })
  it("creates a cross-project destination, previews both events, edits it and preserves the resource form", async () => {
    render(<WebhooksPage />, { wrapper: provider() })
    const dialog = within(
      await screen.findByRole("dialog", { name: "New Release Health webhook" })
    )
    await waitFor(() =>
      expect(
        dialog.getByRole("button", { name: "Create webhook" })
      ).toBeEnabled()
    )
    fireEvent.change(dialog.getByRole("textbox", { name: "Name" }), {
      target: { value: "Operations" },
    })
    fireEvent.change(dialog.getByLabelText("Endpoint"), {
      target: { value: "https://example.com/alerts" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Choose environments" }))
    const picker = within(
      await screen.findByRole("dialog", { name: "Choose environments" })
    )
    fireEvent.click(
      picker.getByRole("button", {
        name: /Production\s*project\/api:env\/prod/,
      })
    )
    fireEvent.click(
      picker.getByRole("button", { name: "Apply environments (2)" })
    )
    fireEvent.click(dialog.getByRole("button", { name: "Preview payload" }))
    const preview = within(
      await screen.findByRole("dialog", { name: "Alert payload preview" })
    )
    expect(preview.getByLabelText("Rendered alert payload")).toHaveTextContent(
      '"recoveredAt": null'
    )
    fireEvent.click(preview.getByRole("tab", { name: "Alert recovered" }))
    expect(preview.getByLabelText("Rendered alert payload")).toHaveTextContent(
      '"value": 0.8'
    )
    fireEvent.click(preview.getByRole("button", { name: "Close" }))
    fireEvent.click(dialog.getByRole("button", { name: "Create webhook" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(serverItems()[0].scopes).toEqual([
      "project/prod",
      "other/other-prod",
    ])
    fireEvent.click(screen.getByRole("button", { name: "Edit Operations" }))
    const edit = within(
      await screen.findByRole("dialog", { name: "Edit Release Health webhook" })
    )
    fireEvent.click(edit.getByRole("switch", { name: "Active" }))
    fireEvent.click(edit.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(screen.getByText("Inactive")).toBeVisible())
    fireEvent.click(screen.getByRole("tab", { name: "Resource changes" }))
    expect(await screen.findByText("No webhooks yet")).toBeVisible()
    fireEvent.click(screen.getAllByRole("button", { name: "New webhook" })[0])
    expect(
      await screen.findByRole("dialog", { name: "New webhook" })
    ).toBeVisible()
    expect(screen.getByText("Feature flag")).toBeVisible()
    expect(screen.getByText("Segment")).toBeVisible()
    expect(createWebhook).not.toHaveBeenCalled()
    expect(sendTestWebhook).not.toHaveBeenCalled()
  })
  it("keeps saved authentication write-only on reopen, supports explicit removal and discards unsaved changes", async () => {
    await saveReleaseHealthWebhook(previewStoreKey()!, {
      ...draft("Authenticated"),
      headers: [{ key: "Authorization", value: "sample-token" }],
      secret: "sample-signing",
    })
    render(<WebhooksPage />, {
      wrapper: provider("/en/webhooks?category=release-health"),
    })
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Authenticated" })
    )
    const edit = within(
      await screen.findByRole("dialog", { name: "Edit Release Health webhook" })
    )
    expect(edit.getByLabelText("Header 1 value")).toHaveValue("")
    expect(edit.getByLabelText("Secret", { exact: true })).toHaveValue("")
    expect(edit.getByText(/A signing secret is configured/)).toBeVisible()
    fireEvent.change(edit.getByLabelText("Secret", { exact: true }), {
      target: { value: "unsaved" },
    })
    fireEvent.click(edit.getByRole("button", { name: "Cancel" }))
    const discard = within(
      await screen.findByRole("dialog", { name: "Discard changes?" })
    )
    fireEvent.click(discard.getByRole("button", { name: /Discard/ }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(serverItems()[0].hasSecret).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Edit Authenticated" }))
    const reopened = within(
      await screen.findByRole("dialog", { name: "Edit Release Health webhook" })
    )
    fireEvent.click(
      reopened.getByRole("button", { name: "Remove saved headers" })
    )
    fireEvent.click(
      reopened.getByRole("button", { name: "Remove saved secret" })
    )
    await waitFor(() =>
      expect(
        reopened.getByRole("button", { name: "Save changes" })
      ).toBeEnabled()
    )
    fireEvent.click(reopened.getByRole("button", { name: "Save changes" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(serverItems()[0]).toMatchObject({
      hasHeaders: false,
      hasSecret: false,
    })
    expect(sendTestWebhook).not.toHaveBeenCalled()
    expect(createWebhook).not.toHaveBeenCalled()
  })
  it("rejects malformed headers and header injection while allowing optional empty rows", () => {
    for (const key of ["Bad Name", "X:Name", ""]) {
      expect(
        webhookHeadersSchema.safeParse([{ key, value: "example" }]).success
      ).toBe(false)
    }
    for (const value of ["hello\r\nX-Other: injected", "hello\0"]) {
      expect(
        webhookHeadersSchema.safeParse([{ key: "X-Example", value }]).success
      ).toBe(false)
    }
    expect(
      webhookHeadersSchema.safeParse([{ key: "", value: "" }]).success
    ).toBe(true)
  })
  it("blocks templates that fail for recovery while retaining the draft", async () => {
    render(<WebhooksPage />, { wrapper: provider() })
    const dialog = within(
      await screen.findByRole("dialog", { name: "New Release Health webhook" })
    )
    await waitFor(() =>
      expect(
        dialog.getByRole("button", { name: "Create webhook" })
      ).toBeEnabled()
    )
    fireEvent.change(dialog.getByRole("textbox", { name: "Name" }), {
      target: { value: "Draft" },
    })
    fireEvent.change(dialog.getByLabelText("Endpoint"), {
      target: { value: "https://example.com/alerts" },
    })
    fireEvent.click(dialog.getByRole("radio", { name: "Custom" }))
    fireEvent.change(dialog.getByLabelText("Payload template editor"), {
      target: {
        value:
          '{{#if (eq event.type "alert.recovered")}}invalid{{else}}{}{{/if}}',
      },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Create webhook" }))
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "both alert events"
    )
    expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("Draft")
    expect(serverItems()).toEqual([])
  })
})
