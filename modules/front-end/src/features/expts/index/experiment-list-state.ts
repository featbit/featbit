import type {
  ExperimentDetail,
  ExperimentRunDetail,
} from "../details/experiment-details-types"
import { hasCapturedLearning } from "../details/learning/learning-utils"
import type { ExperimentListItem } from "./experiment-types"

export const EXPERIMENT_LIST_STATES = [
  "hypothesis",
  "implementing",
  "measuring",
  "waitDecision",
  "decision",
  "learnt",
] as const

export type ExperimentListStateKey = (typeof EXPERIMENT_LIST_STATES)[number]
export type ExperimentListFilter = ExperimentListStateKey | "all"
export type ExperimentListState =
  | { key: Exclude<ExperimentListStateKey, "decision"> }
  | { key: "decision"; decision: string }

export type ExperimentListDataItem = ExperimentListItem &
  Pick<ExperimentDetail, "experimentRuns" | "lastLearning">

export type ExperimentListRow = ExperimentListItem & {
  listState: ExperimentListState
}

export type ExperimentListData = {
  items: ExperimentListDataItem[]
  totalCount: number
  scope: "page" | "all"
}

function observationWindow(run: ExperimentRunDetail) {
  const start = run.observationStart ? Date.parse(run.observationStart) : null
  const end = run.observationEnd ? Date.parse(run.observationEnd) : null
  if (
    (start !== null && !Number.isFinite(start)) ||
    (end !== null && !Number.isFinite(end)) ||
    (start !== null && end !== null && end < start)
  )
    return null
  return { start, end }
}

export function experimentListState(
  experiment: Pick<
    ExperimentListDataItem,
    "flagKey" | "experimentRuns" | "lastLearning"
  >,
  now: number
): ExperimentListState {
  const runs = experiment.experimentRuns
  const latestRun = [...runs].sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      right.id.localeCompare(left.id)
  )[0]
  const decision = latestRun?.decision?.trim()

  // A decision from an earlier run must not hide a new observation cycle.
  if (decision) {
    if (experiment.lastLearning?.trim() || hasCapturedLearning(latestRun)) {
      return { key: "learnt" }
    }
    return { key: "decision", decision }
  }

  const windows = runs.map(observationWindow)
  if (
    windows.some(
      (window) =>
        window &&
        window.start !== null &&
        window.start <= now &&
        (window.end === null || now < window.end)
    )
  ) {
    return { key: "measuring" }
  }
  if (
    windows.some((window) => window && window.end !== null && window.end <= now)
  ) {
    return { key: "waitDecision" }
  }
  // Scheduled runs and runs without an observation window are still in exposure.
  return {
    key:
      runs.length || experiment.flagKey?.trim() ? "implementing" : "hypothesis",
  }
}

export function selectExperimentListPage(
  data: ExperimentListData,
  filter: ExperimentListFilter,
  pageIndex: number,
  pageSize: number,
  now: number
) {
  const rows: ExperimentListRow[] = data.items.map((experiment) => ({
    ...experiment,
    listState: experimentListState(experiment, now),
  }))
  const filtered =
    filter === "all" ? rows : rows.filter((row) => row.listState.key === filter)
  const totalCount = data.scope === "all" ? filtered.length : data.totalCount
  const currentPage = Math.min(
    pageIndex,
    Math.max(1, Math.ceil(totalCount / pageSize))
  )
  return {
    items:
      data.scope === "all"
        ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
        : filtered,
    totalCount,
    pageIndex: currentPage,
  }
}

export function experimentListStateDot(state: ExperimentListStateKey) {
  switch (state) {
    case "implementing":
      return "bg-emerald-600"
    case "measuring":
      return "bg-blue-500"
    case "waitDecision":
      return "bg-amber-500"
    case "decision":
      return "bg-violet-500"
    case "learnt":
      return "bg-emerald-600"
    default:
      return "bg-zinc-400"
  }
}
