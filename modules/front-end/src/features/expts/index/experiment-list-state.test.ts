import { describe, expect, it } from "vitest"
import type { ExperimentRunDetail } from "../details/experiment-details-types"
import {
  experimentListState,
  selectExperimentListPage,
  type ExperimentListDataItem,
} from "./experiment-list-state"

const now = Date.parse("2026-09-06T12:00:00Z")
const run: ExperimentRunDetail = {
  id: "run-1",
  slug: "run-1",
  status: "draft",
  method: "bayesian_ab",
  observationStart: "2026-09-01T00:00:00Z",
  observationEnd: "2026-09-07T00:00:00Z",
  decision: null,
  decisionSummary: null,
  decisionReason: null,
  whatChanged: null,
  whatHappened: null,
  confirmedOrRefuted: null,
  whyItHappened: null,
  nextHypothesis: null,
  createdAt: "2026-09-01T00:00:00Z",
}
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
  experimentRuns: [run],
  createdAt: run.createdAt,
  updatedAt: run.createdAt,
}

describe("experiment list state", () => {
  it("uses the observation window regardless of saved stage or obsolete run status", () => {
    for (const status of ["draft", "collecting", "analyzing", "decided", ""]) {
      expect(
        experimentListState(
          { ...experiment, experimentRuns: [{ ...run, status }] },
          now
        )
      ).toEqual({ key: "measuring" })
    }
  })

  it("displays the latest run's decision even during observation", () => {
    expect(
      experimentListState(
        { ...experiment, experimentRuns: [{ ...run, decision: " ROLLBACK " }] },
        now
      )
    ).toEqual({ key: "decision", decision: "ROLLBACK" })
  })

  it("does not let an old decision or learning override a new observing run", () => {
    const older = {
      ...run,
      id: "old",
      decision: "PAUSE",
      whatHappened: "Old finding",
    }
    const newest = { ...run, id: "new", createdAt: "2026-09-06T08:00:00+08:00" }
    for (const experimentRuns of [
      [older, newest],
      [newest, older],
    ]) {
      expect(
        experimentListState(
          { ...experiment, lastLearning: "Previous cycle", experimentRuns },
          now
        )
      ).toEqual({ key: "measuring" })
    }
  })

  it("uses creation time rather than response order to select the latest decision", () => {
    expect(
      experimentListState(
        {
          ...experiment,
          experimentRuns: [
            {
              ...run,
              id: "new",
              decision: "CONTINUE",
              createdAt: "2026-09-06T08:00:00+08:00",
            },
            { ...run, id: "old", decision: "PAUSE" },
          ],
        },
        now
      )
    ).toEqual({ key: "decision", decision: "CONTINUE" })
  })

  it("shows Learnt when the latest decision has run learning or an experiment key learning", () => {
    expect(
      experimentListState(
        {
          ...experiment,
          experimentRuns: [
            { ...run, decision: "CONTINUE", whatHappened: "Improved" },
          ],
        },
        now
      )
    ).toEqual({ key: "learnt" })
    expect(
      experimentListState(
        {
          ...experiment,
          lastLearning: "Improved",
          experimentRuns: [{ ...run, decision: "CONTINUE" }],
        },
        now
      )
    ).toEqual({ key: "learnt" })
  })

  it("does not count whitespace or an earlier run's learning as the latest run's learning", () => {
    expect(
      experimentListState(
        {
          ...experiment,
          lastLearning: " \n ",
          experimentRuns: [
            { ...run, whatHappened: "Old finding" },
            {
              ...run,
              id: "new",
              createdAt: "2026-09-06T00:00:00Z",
              decision: "PAUSE",
              whatHappened: "  ",
            },
          ],
        },
        now
      )
    ).toEqual({ key: "decision", decision: "PAUSE" })
  })

  it("requires a decision before displaying Learnt", () => {
    expect(
      experimentListState(
        {
          ...experiment,
          lastLearning: "A finding",
          experimentRuns: [{ ...run, decision: "  " }],
        },
        now
      )
    ).toEqual({ key: "measuring" })
  })

  it("keeps Measuring when any run is observing, even when another has ended", () => {
    expect(
      experimentListState(
        {
          ...experiment,
          experimentRuns: [
            run,
            { ...run, id: "ended", observationEnd: "2026-09-02T00:00:00Z" },
          ],
        },
        now
      )
    ).toEqual({ key: "measuring" })
  })

  it("switches from exposure to measuring at the start, and to wait decision at the end", () => {
    const start = Date.parse(run.observationStart!)
    const end = Date.parse(run.observationEnd!)
    expect(experimentListState(experiment, start - 1)).toEqual({
      key: "implementing",
    })
    expect(experimentListState(experiment, start)).toEqual({ key: "measuring" })
    expect(experimentListState(experiment, end - 1)).toEqual({
      key: "measuring",
    })
    expect(experimentListState(experiment, end)).toEqual({
      key: "waitDecision",
    })
  })

  it("keeps an open-ended window measuring after its start", () => {
    expect(
      experimentListState(
        { ...experiment, experimentRuns: [{ ...run, observationEnd: null }] },
        now
      )
    ).toEqual({ key: "measuring" })
  })

  it.each([
    { observationStart: null, observationEnd: null },
    { observationStart: "invalid", observationEnd: null },
    { observationStart: run.observationStart, observationEnd: "invalid" },
    {
      observationStart: run.observationEnd,
      observationEnd: run.observationStart,
    },
  ])(
    "keeps an unconfigured or invalid observation window in exposure: %s",
    (window) => {
      expect(
        experimentListState(
          { ...experiment, experimentRuns: [{ ...run, ...window }] },
          now
        )
      ).toEqual({ key: "implementing" })
    }
  )

  it("uses the feature flag only when there are no runs", () => {
    expect(
      experimentListState({ ...experiment, experimentRuns: [] }, now)
    ).toEqual({ key: "implementing" })
    expect(
      experimentListState(
        { ...experiment, experimentRuns: [], flagKey: " " },
        now
      )
    ).toEqual({ key: "hypothesis" })
    expect(experimentListState({ ...experiment, flagKey: null }, now)).toEqual({
      key: "measuring",
    })
  })
})

describe("derived stage filtering and pagination", () => {
  it("filters the full set before counting and paginating, preserving server order", () => {
    const items = Array.from({ length: 24 }, (_, index) => ({
      ...experiment,
      id: String(index),
      experimentRuns: [
        {
          ...run,
          observationEnd:
            index % 2 ? run.observationEnd : "2026-09-02T00:00:00Z",
        },
      ],
    }))
    const result = selectExperimentListPage(
      { items, totalCount: 24, scope: "all" },
      "measuring",
      2,
      10,
      now
    )
    expect(result.totalCount).toBe(12)
    expect(result.items.map((item) => item.id)).toEqual(["21", "23"])
    expect(
      result.items.every((item) => item.listState.key === "measuring")
    ).toBe(true)
  })

  it("updates the filtered count and clamps the page as observation windows end", () => {
    const data = { items: [experiment], totalCount: 1, scope: "all" as const }
    expect(
      selectExperimentListPage(data, "measuring", 1, 10, now).totalCount
    ).toBe(1)
    expect(
      selectExperimentListPage(
        data,
        "measuring",
        2,
        10,
        Date.parse(run.observationEnd!)
      )
    ).toEqual({ items: [], totalCount: 0, pageIndex: 1 })
  })

  it("preserves server pagination and count when there is no stage filter", () => {
    const result = selectExperimentListPage(
      { items: [experiment], totalCount: 21, scope: "page" },
      "all",
      3,
      10,
      now
    )
    expect(result.items).toHaveLength(1)
    expect(result.totalCount).toBe(21)
    expect(result.pageIndex).toBe(3)
  })
})
