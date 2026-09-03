import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
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
    vi.mocked(releaseHealthApi.previewBinding).mockResolvedValue({
      status: "no_data",
      queriedAt: "2026-09-03T00:00:00Z",
      resultContract: metric.resultContract,
      points: [],
      freshnessSeconds: null,
    })
  })
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
