import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { fetchExperimentDetail } from "../details/experiment-details-api"
import type { ExperimentDetail } from "../details/experiment-details-types"
import { ExperimentDetailsPage } from "../details/hypothesis/experiment-details-page"
import type {
  ExperimentListData,
  ExperimentListDataItem,
} from "./experiment-list-state"
import { createExperiment, fetchExperimentList } from "./experiments-api"
import { ExperimentsPage } from "./experiments-page"

vi.mock("@/features/layout/layout-context", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/layout/layout-context")
  >()),
  getCurrentProjectEnv: () => ({
    envId: "env-1",
    envName: "Test environment",
    projectKey: "project-1",
    projectName: "Test project",
  }),
}))
vi.mock("../details/experiment-details-api", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../details/experiment-details-api")
  >()),
  fetchExperimentDetail: vi.fn(),
}))
vi.mock("./experiments-api", () => ({
  fetchExperimentList: vi.fn(),
  createExperiment: vi.fn(),
}))
vi.mock("./components/flag-key-filter", () => ({ FlagKeyFilter: () => null }))

const experiment: ExperimentListDataItem = {
  id: "experiment-1",
  name: "Checkout",
  description: null,
  stage: "hypothesis",
  flagKey: "checkout",
  featBitProjectKey: null,
  featBitEnvId: "env-1",
  runCount: 1,
  runMethodSummary: "Bayesian",
  lastLearning: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  experimentRuns: [
    {
      id: "run-1",
      slug: "run-1",
      status: "draft",
      method: "bayesian_ab",
      observationStart: "2026-09-01T00:00:00Z",
      observationEnd: "2026-09-06T12:00:15Z",
      decision: null,
      decisionSummary: null,
      decisionReason: null,
      whatChanged: null,
      whatHappened: null,
      confirmedOrRefuted: null,
      whyItHappened: null,
      nextHypothesis: null,
      createdAt: "2026-09-01T00:00:00Z",
    },
  ],
}

function mountPage(queryClient: QueryClient, search = "") {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/en/experiments${search}`]}>
        <Routes>
          <Route path="/:lang/experiments" element={<ExperimentsPage />} />
          <Route
            path="/:lang/experiments/:experimentId"
            element={<ExperimentDetailsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function renderPage(
  items: ExperimentListDataItem[],
  scope: "all" | "page",
  search = ""
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  const data: ExperimentListData = { items, scope, totalCount: items.length }
  queryClient.setQueryData(
    ["experiments", "env-1", "", "", scope, 0, scope === "all" ? 100 : 10],
    data
  )
  vi.mocked(fetchExperimentList).mockResolvedValue(data)
  return { ...mountPage(queryClient, search), queryClient }
}

describe("experiment list refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-06T12:00:00Z"))
    vi.mocked(fetchExperimentList).mockReset()
    vi.mocked(createExperiment).mockReset()
    vi.mocked(fetchExperimentDetail).mockReset()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("changes Measuring to Wait decision as time passes without another request", async () => {
    renderPage([experiment], "page")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText("Measuring")).toBeVisible()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(screen.getByText("Wait decision")).toBeVisible()
    expect(screen.queryByText("Measuring")).not.toBeInTheDocument()
    expect(fetchExperimentList).toHaveBeenCalledTimes(1)
  })

  it("updates filtered pagination when the last item on page two stops measuring", async () => {
    const items = Array.from({ length: 11 }, (_, index) => ({
      ...experiment,
      id: String(index),
      name: `Experiment ${index + 1}`,
      experimentRuns: [
        {
          ...experiment.experimentRuns[0]!,
          observationEnd: index === 10 ? "2026-09-06T12:00:15Z" : null,
        },
      ],
    }))
    renderPage(items, "all", "?stage=measuring&page=2")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText("Showing 11 to 11 of 11 experiments")).toBeVisible()
    expect(screen.getByText("Experiment 11")).toBeVisible()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(screen.getByText("Showing 1 to 10 of 10 experiments")).toBeVisible()
    expect(screen.queryByText("Experiment 11")).not.toBeInTheDocument()
    expect(fetchExperimentList).toHaveBeenCalledTimes(1)
  })

  it("fetches fresh data on re-entry even when the previous list is still cached", async () => {
    const { unmount, queryClient } = renderPage([experiment], "page")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(fetchExperimentList).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Measuring")).toBeVisible()
    unmount()

    vi.mocked(fetchExperimentList).mockResolvedValue({
      items: [
        {
          ...experiment,
          name: "Updated checkout",
          experimentRuns: [
            { ...experiment.experimentRuns[0]!, decision: "CONTINUE" },
          ],
        },
      ],
      scope: "page",
      totalCount: 1,
    })
    mountPage(queryClient)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(fetchExperimentList).toHaveBeenCalledTimes(2)
    expect(screen.getByText("Updated checkout")).toBeVisible()
    expect(screen.getByText("CONTINUE")).toBeVisible()
    expect(screen.queryByText("Measuring")).not.toBeInTheDocument()
  })

  it("loads a fresh list after creating an experiment and following the detail back link", async () => {
    vi.useRealTimers()
    const created: ExperimentListDataItem = {
      ...experiment,
      id: "new-experiment",
      name: "New checkout",
      flagKey: null,
      runCount: 0,
      runMethodSummary: null,
      experimentRuns: [],
    }
    const detail: ExperimentDetail = {
      ...created,
      hypothesis: null,
      goal: null,
      intent: null,
      change: null,
      constraints: null,
      conflictAnalysis: null,
      primaryMetric: null,
      guardrails: null,
    }
    vi.mocked(createExperiment).mockResolvedValue(created)
    vi.mocked(fetchExperimentDetail).mockResolvedValue(detail)
    renderPage([experiment], "page")
    await screen.findByRole("link", { name: experiment.name })

    fireEvent.click(screen.getByRole("button", { name: "New experiment" }))
    fireEvent.change(screen.getByLabelText("Name *"), {
      target: { value: created.name },
    })
    const submit = screen.getByRole("button", { name: "Create experiment" })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    expect(
      await screen.findByRole("heading", { name: created.name })
    ).toBeVisible()
    expect(createExperiment).toHaveBeenCalledWith("env-1", {
      name: created.name,
      description: null,
      featBitProjectKey: "project-1",
    })

    let finishRefresh!: (data: ExperimentListData) => void
    vi.mocked(fetchExperimentList).mockReturnValueOnce(
      new Promise((resolve) => {
        finishRefresh = resolve
      })
    )
    fireEvent.click(screen.getByRole("link", { name: "Experiments" }))
    expect(fetchExperimentList).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(experiment.name)).not.toBeInTheDocument()
    expect(
      screen.queryByText("Showing 1 to 1 of 1 experiments")
    ).not.toBeInTheDocument()

    await act(async () => {
      finishRefresh({
        items: [created, experiment],
        totalCount: 2,
        scope: "page",
      })
    })
    expect(
      await screen.findByRole("link", { name: created.name })
    ).toBeVisible()
    expect(screen.getByText("Showing 1 to 2 of 2 experiments")).toBeVisible()
  })

  it("shows a retryable error instead of the old list when the return refresh fails", async () => {
    const { unmount, queryClient } = renderPage([experiment], "page")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    unmount()
    vi.mocked(fetchExperimentList).mockRejectedValueOnce(new Error("Offline"))
    mountPage(queryClient)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.queryByText(experiment.name)).not.toBeInTheDocument()
    expect(
      screen.queryByText("Showing 1 to 1 of 1 experiments")
    ).not.toBeInTheDocument()
    const retry = screen.getByRole("button", { name: "Retry" })
    expect(retry).toBeVisible()
    fireEvent.click(retry)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText(experiment.name)).toBeVisible()
  })

  it("cancels an unfinished request on leaving and starts a new one on immediate re-entry", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    let completeOldRequest!: (data: ExperimentListData) => void
    const oldRequest = new Promise<ExperimentListData>((resolve) => {
      completeOldRequest = resolve
    })
    const freshData: ExperimentListData = {
      items: [{ ...experiment, name: "Fresh checkout" }],
      totalCount: 1,
      scope: "page",
    }
    vi.mocked(fetchExperimentList)
      .mockReturnValueOnce(oldRequest)
      .mockResolvedValueOnce(freshData)

    const { unmount } = mountPage(queryClient)
    const oldSignal = vi.mocked(fetchExperimentList).mock.calls[0]?.[2]
    unmount()
    expect(oldSignal?.aborted).toBe(true)

    mountPage(queryClient)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(fetchExperimentList).toHaveBeenCalledTimes(2)
    expect(vi.mocked(fetchExperimentList).mock.calls[1]?.[2]?.aborted).toBe(
      false
    )
    expect(screen.getByText("Fresh checkout")).toBeVisible()

    // Even if an old transport delivers a late response, it must not replace the new result.
    await act(async () => {
      completeOldRequest({ items: [experiment], totalCount: 1, scope: "page" })
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText("Fresh checkout")).toBeVisible()
    expect(
      queryClient.getQueryData(["experiments", "env-1", "", "", "page", 0, 10])
    ).toEqual(freshData)
  })

  it("cancels the old request when the name filter changes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    let completeOldRequest!: (data: ExperimentListData) => void
    vi.mocked(fetchExperimentList)
      .mockReturnValueOnce(
        new Promise<ExperimentListData>((resolve) => {
          completeOldRequest = resolve
        })
      )
      .mockResolvedValueOnce({
        items: [{ ...experiment, name: "Filtered checkout" }],
        totalCount: 1,
        scope: "page",
      })

    mountPage(queryClient)
    const oldSignal = vi.mocked(fetchExperimentList).mock.calls[0]?.[2]
    fireEvent.change(screen.getByPlaceholderText("Filter by experiment name"), {
      target: { value: "Filtered" },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(oldSignal?.aborted).toBe(true)
    expect(fetchExperimentList).toHaveBeenCalledTimes(2)
    expect(vi.mocked(fetchExperimentList).mock.calls[1]?.[1].name).toBe(
      "Filtered"
    )
    expect(screen.getByText("Filtered checkout")).toBeVisible()
    await act(async () => {
      completeOldRequest({ items: [experiment], totalCount: 1, scope: "page" })
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.getByText("Filtered checkout")).toBeVisible()
  })
})
