import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { fetchApi } from "@/lib/api/authenticated-api"
import type { ExperimentDetail } from "../experiment-details-types"
import { MeasuringDetails } from "./measuring-details"
import type { MeasuringRun } from "./measuring-types"

vi.mock("@/lib/api/authenticated-api", () => ({ fetchApi: vi.fn() }))

describe("creating an experiment run", () => {
  it("offers only Bayesian and sends its method together with the selected roles", async () => {
    const experiment: ExperimentDetail = {
      id: "experiment-1",
      name: "Checkout",
      description: null,
      stage: "measuring",
      flagKey: "checkout",
      featBitProjectKey: "project-1",
      featBitEnvId: "env-1",
      runCount: 0,
      hypothesis: null,
      goal: null,
      intent: null,
      change: null,
      constraints: null,
      conflictAnalysis: null,
      lastLearning: null,
      primaryMetric: null,
      guardrails: null,
      experimentRuns: [],
      createdAt: "2026-09-10T00:00:00Z",
      updatedAt: "2026-09-10T00:00:00Z",
    }
    const createdRun: MeasuringRun = {
      id: "run-1",
      slug: "run-1",
      method: "bayesian_ab",
      decision: null,
      decisionSummary: null,
      decisionReason: null,
      whatChanged: null,
      whatHappened: null,
      confirmedOrRefuted: null,
      whyItHappened: null,
      nextHypothesis: null,
      createdAt: "2026-09-10T00:00:00Z",
    }
    vi.mocked(fetchApi).mockResolvedValue({
      ...experiment,
      experimentRuns: [createdRun],
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    queryClient.setQueryData(["experiment-feature-flag", "env-1", "checkout"], {
      variations: [
        { id: "control-id", name: "Original", value: "false" },
        { id: "treatment-id", name: "Updated", value: "true" },
      ],
    })
    queryClient.setQueryData(
      ["experiment-layers", "env-1", "active", "measuring-assignment"],
      { items: [], totalCount: 0 }
    )
    render(
      <QueryClientProvider client={queryClient}>
        <MeasuringDetails experiment={experiment} envId="env-1" />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getAllByRole("button", { name: "New run" })[0])
    const dialog = within(screen.getByRole("dialog"))
    const methods = within(dialog.getAllByRole("radiogroup")[0])
    expect(methods.getAllByRole("radio")).toHaveLength(1)
    expect(
      methods.getByRole("radio", { name: /Bayesian A\/B\/n/ })
    ).toBeChecked()
    expect(dialog.getByText("Control & Treatments")).toBeInTheDocument()

    fireEvent.click(dialog.getByRole("radio", { name: "Updated" }))
    const minimum = dialog.getByRole("spinbutton", {
      name: "Minimum sample per variant",
    })
    fireEvent.change(minimum, { target: { value: "-1" } })
    fireEvent.click(dialog.getByRole("button", { name: "Create run" }))
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Enter a whole number"
    )
    expect(fetchApi).not.toHaveBeenCalled()
    fireEvent.change(minimum, { target: { value: "500" } })
    fireEvent.click(dialog.getByRole("button", { name: "Create run" }))

    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(3))
    const [path, options] = vi.mocked(fetchApi).mock.calls[1]
    expect(path).toBe("/api/v1/envs/env-1/experiments/experiment-1/runs/run-1")
    expect(options?.method).toBe("PUT")
    expect(JSON.parse(options?.body as string)).toEqual({
      method: "bayesian_ab",
      controlVariant: "treatment-id",
      treatmentVariant: "control-id",
      minimumSample: 500,
    })
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    queryClient.clear()
  })
})
