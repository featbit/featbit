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
  readPreviewWebhooks,
  removePreviewWebhook,
  savePreviewWebhook,
  useReleaseHealthWebhooks,
  type ReleaseHealthWebhookDraft,
} from "./preview-store"

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

describe("preview destination lifecycle", () => {
  it("shows the current default for saved destinations without rewriting custom templates or storage on read", () => {
    const key = previewStoreKey()!
    const legacy = '{"evaluation": {{json evaluation}} }'
    const stored = JSON.stringify([
      {
        ...draft(),
        id: "default",
        purpose: "release-health",
        payloadTemplate: legacy,
      },
      {
        ...draft("Custom"),
        id: "custom",
        purpose: "release-health",
        payloadTemplateType: "custom",
        payloadTemplate: legacy,
      },
    ])
    localStorage.setItem(key, stored)
    const [standard, custom] = readPreviewWebhooks(key)
    expect(standard.payloadTemplate).toBe(ALERT_PAYLOAD_TEMPLATE)
    expect(custom.payloadTemplate).toBe(legacy)
    expect(localStorage.getItem(key)).toBe(stored)
  })
  it("keeps organization, workspace and user catalogues isolated and excludes credentials", () => {
    const key = previewStoreKey()!
    const saved = savePreviewWebhook(key, {
      ...draft(),
      secret: "must-not-persist",
      headers: [{ key: "Authorization", value: "must-not-persist" }],
    } as ReleaseHealthWebhookDraft)
    expect(readPreviewWebhooks(key)).toEqual([saved])
    expect(saved.secret).toBe("must-not-persist")
    expect(saved.headers).toEqual([
      { key: "Authorization", value: "must-not-persist" },
    ])
    expect(localStorage.getItem(key)).not.toContain("must-not-persist")
    identity.org = "another-org"
    expect(readPreviewWebhooks(previewStoreKey()!)).toEqual([])
    identity.org = "org"
    identity.workspace = "another-workspace"
    expect(readPreviewWebhooks(previewStoreKey()!)).toEqual([])
    identity.workspace = "workspace"
    identity.user = "another-user"
    expect(readPreviewWebhooks(previewStoreKey()!)).toEqual([])
  })
  it("filters exact scopes and active purpose, preserves identity on edits, and rejects duplicates or stale edits", () => {
    const key = previewStoreKey()!
    const saved = savePreviewWebhook(key, draft())
    expect(availableAlertWebhooks([saved], "project", "prod")).toHaveLength(1)
    expect(availableAlertWebhooks([saved], "other", "other-prod")).toHaveLength(
      1
    )
    expect(availableAlertWebhooks([saved], "project", "pro")).toEqual([])
    expect(
      availableAlertWebhooks([{ ...saved, isActive: false }], "project", "prod")
    ).toEqual([])
    expect(() => savePreviewWebhook(key, draft(" operations "))).toThrow(
      "duplicate"
    )
    expect(
      savePreviewWebhook(key, { ...draft(), isActive: false }, saved.id).id
    ).toBe(saved.id)
    removePreviewWebhook(key, saved.id)
    expect(() => savePreviewWebhook(key, draft(), saved.id)).toThrow("missing")
  })
  it("refreshes the catalogue when another tab saves and reports malformed storage without overwriting it", async () => {
    const key = previewStoreKey()!
    const { result } = renderHook(() => useReleaseHealthWebhooks(), {
      wrapper: provider(),
    })
    await waitFor(() => expect(result.current.data).toEqual([]))
    localStorage.setItem(
      key,
      JSON.stringify([
        { ...draft(), id: "from-other-tab", purpose: "release-health" },
      ])
    )
    window.dispatchEvent(new StorageEvent("storage", { key }))
    await waitFor(() =>
      expect(result.current.data?.[0].id).toBe("from-other-tab")
    )
    localStorage.setItem(key, "broken")
    expect(() => savePreviewWebhook(key, draft())).toThrow()
    expect(localStorage.getItem(key)).toBe("broken")
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
    savePreviewWebhook(key, draft("Shared production"))
    savePreviewWebhook(key, {
      ...draft("Storefront development"),
      scopes: ["project/dev"],
      scopeNames: ["Storefront/Development"],
    })
    savePreviewWebhook(key, {
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
    expect(readPreviewWebhooks(previewStoreKey()!)[0].scopes).toEqual([
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
  it("edits authentication, validates duplicate headers, retains saved values on reopen, and discards unsaved changes", async () => {
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
      target: { value: "Authenticated" },
    })
    fireEvent.change(dialog.getByLabelText("Endpoint"), {
      target: { value: "https://example.com/alerts" },
    })
    fireEvent.change(dialog.getByLabelText("Header 1 name"), {
      target: { value: "Authorization" },
    })
    fireEvent.change(dialog.getByLabelText("Header 1 value"), {
      target: { value: "Bearer sample-only" },
    })
    fireEvent.change(dialog.getByLabelText("Secret", { exact: true }), {
      target: { value: "sample-signing-only" },
    })
    expect(dialog.getByLabelText("Secret", { exact: true })).toHaveAttribute(
      "type",
      "password"
    )
    fireEvent.click(dialog.getByRole("button", { name: "Show or hide secret" }))
    expect(dialog.getByLabelText("Secret", { exact: true })).toHaveAttribute(
      "type",
      "text"
    )
    fireEvent.click(dialog.getByRole("button", { name: "Add header" }))
    fireEvent.change(dialog.getByLabelText("Header 2 name"), {
      target: { value: "authorization" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Create webhook" }))
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Header names must be unique"
    )
    expect(readPreviewWebhooks(previewStoreKey()!)).toEqual([])
    fireEvent.change(dialog.getByLabelText("Header 2 name"), {
      target: { value: "X-Service" },
    })
    fireEvent.change(dialog.getByLabelText("Header 2 value"), {
      target: { value: "checkout" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Create webhook" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(localStorage.getItem(previewStoreKey()!)).not.toContain(
      "sample-only"
    )
    expect(localStorage.getItem(previewStoreKey()!)).not.toContain(
      "sample-signing-only"
    )
    fireEvent.click(screen.getByRole("button", { name: "Edit Authenticated" }))
    const edit = within(
      await screen.findByRole("dialog", { name: "Edit Release Health webhook" })
    )
    expect(edit.getByLabelText("Header 1 value")).toHaveValue(
      "Bearer sample-only"
    )
    expect(edit.getByLabelText("Header 2 value")).toHaveValue("checkout")
    expect(edit.getByLabelText("Secret", { exact: true })).toHaveValue(
      "sample-signing-only"
    )
    expect(edit.getByLabelText("Secret", { exact: true })).toHaveAttribute(
      "type",
      "password"
    )
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
    expect(readPreviewWebhooks(previewStoreKey()!)[0].secret).toBe(
      "sample-signing-only"
    )
    fireEvent.click(screen.getByRole("button", { name: "Edit Authenticated" }))
    const reopened = within(
      await screen.findByRole("dialog", { name: "Edit Release Health webhook" })
    )
    fireEvent.click(reopened.getByRole("button", { name: "Remove header 2" }))
    fireEvent.click(reopened.getByRole("button", { name: "Remove header 1" }))
    fireEvent.change(reopened.getByLabelText("Secret", { exact: true }), {
      target: { value: "" },
    })
    fireEvent.click(reopened.getByRole("button", { name: "Save changes" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(readPreviewWebhooks(previewStoreKey()!)[0]).toMatchObject({
      headers: [],
      secret: "",
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
    expect(readPreviewWebhooks(previewStoreKey()!)).toEqual([])
  })
})
