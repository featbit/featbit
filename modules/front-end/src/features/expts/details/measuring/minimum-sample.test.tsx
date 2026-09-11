import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { fetchApi } from "@/lib/api/authenticated-api"
import type { ExperimentDetail } from "../experiment-details-types"
import { EditMinimumSampleDialog } from "./edit-minimum-sample-dialog"
import { MeasuringDetails } from "./measuring-details"
import type { MeasuringRun } from "./measuring-types"

vi.mock("@/lib/api/authenticated-api", () => ({ fetchApi: vi.fn() }))

const run: MeasuringRun = {
  id: "run-1",
  slug: "run-1",
  method: "bayesian_ab",
  minimumSample: 100,
  controlVariant: "control",
  treatmentVariant: "candidate",
  observationStart: "2026-09-07T00:00:00Z",
  observationEnd: null,
  primaryMetricEvent: "purchase",
  decision: null,
  decisionSummary: null,
  decisionReason: null,
  whatChanged: null,
  whatHappened: null,
  confirmedOrRefuted: null,
  whyItHappened: null,
  nextHypothesis: null,
  createdAt: "2026-09-07T00:00:00Z",
}

const experiment: ExperimentDetail = {
  id: "experiment-1",
  name: "Checkout",
  description: null,
  stage: "measuring",
  flagKey: "checkout",
  featBitProjectKey: "project-1",
  featBitEnvId: "env-1",
  runCount: 1,
  hypothesis: null,
  goal: null,
  intent: null,
  change: null,
  constraints: null,
  conflictAnalysis: null,
  lastLearning: null,
  primaryMetric: null,
  guardrails: null,
  experimentRuns: [run],
  createdAt: run.createdAt,
  updatedAt: run.createdAt,
}

function renderMeasuring() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(["experiment-feature-flag", "env-1", "checkout"], {
    variations: [
      { id: "control", name: "Original", value: "false" },
      { id: "candidate", name: "Updated", value: "true" },
    ],
  })
  queryClient.setQueryData(
    ["experiment-layers", "env-1", "active", "measuring-assignment"],
    { items: [], totalCount: 0 }
  )
  function CachedMeasuringDetails() {
    const { data } = useQuery({
      queryKey: ["experiment-details", "env-1", experiment.id],
      queryFn: async () => experiment,
      initialData: experiment,
    })
    return <MeasuringDetails experiment={data} envId="env-1" />
  }
  render(
    <QueryClientProvider client={queryClient}>
      <CachedMeasuringDetails />
    </QueryClientProvider>
  )
  return queryClient
}

beforeEach(() => vi.clearAllMocks())

describe("minimum sample settings", () => {
  it.each(["-1", "1.5", "2147483648"])(
    "rejects %s before sending an update",
    async (value) => {
      const onSave = vi.fn()
      render(
        <EditMinimumSampleDialog
          run={run}
          saving={false}
          saveError={false}
          onClose={vi.fn()}
          onSave={onSave}
        />
      )
      fireEvent.change(screen.getByRole("spinbutton"), { target: { value } })
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Enter a whole number"
      )
      expect(onSave).not.toHaveBeenCalled()
    }
  )

  it("updates the run, refreshes the UI, and clears a saved minimum using zero", async () => {
    const queryClient = renderMeasuring()
    vi.mocked(fetchApi).mockResolvedValueOnce({
      ...experiment,
      experimentRuns: [{ ...run, minimumSample: 500 }],
    })
    fireEvent.click(screen.getByRole("button", { name: "Edit minimum sample" }))
    expect(screen.getByRole("spinbutton")).toHaveValue(100)
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "500" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(fetchApi).toHaveBeenLastCalledWith(
      "/api/v1/envs/env-1/experiments/experiment-1/runs/run-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ minimumSample: 500 }),
      })
    )
    expect(
      screen.getByRole("button", { name: "Edit minimum sample" })
    ).toHaveTextContent("500")

    fireEvent.click(screen.getByRole("button", { name: "Edit minimum sample" }))
    expect(screen.getByRole("spinbutton")).toHaveValue(500)
    vi.mocked(fetchApi).mockResolvedValueOnce({
      ...experiment,
      experimentRuns: [{ ...run, minimumSample: 0 }],
    })
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(fetchApi).toHaveBeenLastCalledWith(
      "/api/v1/envs/env-1/experiments/experiment-1/runs/run-1",
      expect.objectContaining({ body: JSON.stringify({ minimumSample: 0 }) })
    )
    expect(
      screen.getByRole("button", { name: "Edit minimum sample" })
    ).toHaveTextContent("No minimum set")
    queryClient.clear()
  })

  it("keeps failed edits available for retry and discards canceled edits", async () => {
    const queryClient = renderMeasuring()
    fireEvent.click(screen.getByRole("button", { name: "Edit minimum sample" }))
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "800" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(fetchApi).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Edit minimum sample" }))
    expect(screen.getByRole("spinbutton")).toHaveValue(100)
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "800" },
    })
    vi.mocked(fetchApi).mockRejectedValueOnce(new Error("Save failed"))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be saved"
    )
    expect(screen.getByRole("spinbutton")).toHaveValue(800)

    vi.mocked(fetchApi).mockResolvedValueOnce({
      ...experiment,
      experimentRuns: [{ ...run, minimumSample: 800 }],
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole("button", { name: "Edit minimum sample" })
    ).toHaveTextContent("800")
    queryClient.clear()
  })

  it("prefills a new run with the previous run's minimum", async () => {
    const queryClient = renderMeasuring()
    fireEvent.click(screen.getByRole("button", { name: "New run" }))
    expect(
      within(screen.getByRole("dialog")).getByRole("spinbutton", {
        name: "Minimum sample per variant",
      })
    ).toHaveValue(100)
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(fetchApi).not.toHaveBeenCalled()
    queryClient.clear()
  })
})
