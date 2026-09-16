import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import { releaseHealthApi, type LiveMetric } from "../release-health-api"
import { LiveBindingEditor } from "./live-source-binding-editor"

vi.mock("../release-health-api", async (original) => ({
  ...(await original<typeof import("../release-health-api")>()),
  releaseHealthApi: {
    connections: vi.fn(),
    binding: vi.fn(),
    previewBinding: vi.fn(),
    saveBinding: vi.fn(),
    testSaved: vi.fn(),
  },
}))
const metric: LiveMetric = {
  id: "m1",
  projectId: "p1",
  metricVersionId: "v1",
  version: 1,
  key: "request_count",
  name: "Requests",
  resultSemantics: "Number of requests in the query window.",
  resultContract: {
    schemaVersion: 1,
    resultKind: "numeric_time_series",
    cardinality: "single",
    measurementKind: "count",
    unit: { kind: "count" },
    constraints: { allowNaN: false, allowInfinity: false },
  },
}
describe("Live source binding drafts", () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("en")
    vi.mocked(releaseHealthApi.connections).mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        environmentId: "e1",
        providerType: "prometheus-compatible",
        providerSchemaVersion: 1,
        name: "Environment Prometheus",
        providerConfig: { endpoint: "https://metrics.example.test" },
        authentication: { type: "none", secretState: "not_configured" },
        revision: 1,
        version: 1,
        status: "connected",
        lastCheckedAt: "2026-09-03T00:00:00Z",
      },
    ])
    vi.mocked(releaseHealthApi.binding).mockResolvedValue(null)
    vi.mocked(releaseHealthApi.testSaved).mockResolvedValue(true)
    vi.mocked(releaseHealthApi.previewBinding).mockResolvedValue({
      status: "no_data",
      queriedAt: "2026-09-03T00:00:00Z",
      resultContract: metric.resultContract,
      points: [],
      freshnessSeconds: null,
    })
  })
  it("shows the completed test beside its button and clears it on remount even with cached connection status", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-15T12:34:56Z"))
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const editor = (
      <QueryClientProvider client={client}>
        <LiveBindingEditor
          scope={{ projectId: "p1", envId: "e1" }}
          metric={metric}
          onSaved={vi.fn()}
        />
      </QueryClientProvider>
    )
    const first = render(editor)
    const test = await screen.findByRole("button", { name: "Test connection" })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    fireEvent.click(test)
    const result = await screen.findByRole("status")
    await waitFor(() => expect(result).toHaveTextContent("Connected"))
    expect(test.parentElement).toContainElement(result)
    expect(result.querySelector("time")).toHaveAttribute(
      "dateTime",
      "2026-09-15T12:34:56.000Z"
    )
    expect(releaseHealthApi.testSaved).toHaveBeenCalledWith(
      { projectId: "p1", envId: "e1" },
      "11111111-1111-4111-8111-111111111111"
    )
    first.unmount()
    render(editor)
    expect(
      await screen.findByRole("button", { name: "Test connection" })
    ).toBeEnabled()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("discards an in-flight result after selecting a different connection", async () => {
    const scope = { projectId: "p1", envId: "e1" }
    const connections = await releaseHealthApi.connections(scope)
    vi.mocked(releaseHealthApi.connections).mockResolvedValue([
      ...connections,
      {
        ...connections[0],
        id: "22222222-2222-4222-8222-222222222222",
        name: "Another Prometheus",
      },
    ])
    let finish!: (passed: boolean) => void
    vi.mocked(releaseHealthApi.testSaved).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        })
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <LiveBindingEditor scope={scope} metric={metric} onSaved={vi.fn()} />
      </QueryClientProvider>
    )
    fireEvent.click(
      await screen.findByRole("button", { name: "Test connection" })
    )
    expect(await screen.findByRole("status")).toHaveTextContent("Testing…")
    fireEvent.click(screen.getByLabelText("Select connection"))
    const option = await screen.findByRole("option", {
      name: "Another Prometheus",
    })
    await act(async () => {
      fireEvent.pointerDown(option, { pointerType: "mouse" })
      fireEvent.click(option)
    })
    expect(screen.getByLabelText("Select connection")).toHaveTextContent(
      "Another Prometheus"
    )
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    await act(async () => finish(true))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Connected")
    )
    expect(releaseHealthApi.testSaved).toHaveBeenLastCalledWith(
      scope,
      "22222222-2222-4222-8222-222222222222"
    )
  })

  it.each(["rejected", "false"])(
    "shows a %s test failure with its time and replaces it after retry",
    async (failure) => {
      if (failure === "rejected") {
        vi.mocked(releaseHealthApi.testSaved).mockRejectedValueOnce(
          new Error("Unavailable")
        )
      } else {
        vi.mocked(releaseHealthApi.testSaved).mockResolvedValueOnce(false)
      }
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      render(
        <QueryClientProvider client={client}>
          <LiveBindingEditor
            scope={{ projectId: "p1", envId: "e1" }}
            metric={metric}
            onSaved={vi.fn()}
          />
        </QueryClientProvider>
      )
      const test = await screen.findByRole("button", {
        name: "Test connection",
      })
      fireEvent.click(test)
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Connection failed"
        )
      )
      expect(screen.getByRole("status").querySelector("time")).toHaveAttribute(
        "dateTime"
      )
      expect(test).toBeEnabled()
      fireEvent.click(test)
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Connected")
      )
      expect(
        within(screen.getByRole("status")).queryByText("Connection failed")
      ).not.toBeInTheDocument()
    }
  )
  it("invalidates previews after edits and confirms dirty cancellation without saving", async () => {
    const cancel = vi.fn()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <LiveBindingEditor
          scope={{ projectId: "p1", envId: "e1" }}
          metric={metric}
          onSaved={vi.fn()}
          onCancel={cancel}
        />
      </QueryClientProvider>
    )
    fireEvent.change(await screen.findByLabelText("PromQL"), {
      target: { value: "sum(requests_total)" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Validate and preview" })
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save source binding" })
      ).toBeEnabled()
    )
    expect(releaseHealthApi.previewBinding).toHaveBeenCalledWith(
      { projectId: "p1", envId: "e1" },
      metric.id,
      expect.objectContaining({
        providerConfig: {
          promql: "sum(requests_total)",
          queryMode: "range",
          step: "5s",
        },
      })
    )
    fireEvent.change(screen.getByLabelText("PromQL"), {
      target: { value: "sum(other_requests_total)" },
    })
    expect(
      screen.getByRole("button", { name: "Save source binding" })
    ).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(await screen.findByRole("alertdialog")).toBeVisible()
    expect(cancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    expect(cancel).toHaveBeenCalledOnce()
    expect(releaseHealthApi.saveBinding).not.toHaveBeenCalled()
  })
})
