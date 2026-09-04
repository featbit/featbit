import type { ExperimentStage } from "../index/experiment-types"

export const EXPERIMENT_STAGES: ExperimentStage[] = [
  "hypothesis",
  "implementing",
  "measuring",
  "learning",
]

const STAGE_PARAM_BY_STAGE: Record<ExperimentStage, string> = {
  hypothesis: "hypothesis",
  implementing: "exposure",
  measuring: "measuring",
  learning: "learning",
}

const STAGE_BY_PARAM = Object.fromEntries(
  Object.entries(STAGE_PARAM_BY_STAGE).map(([stage, param]) => [param, stage])
) as Record<string, ExperimentStage>

export function experimentStageFromParam(
  value: string | undefined
): ExperimentStage | null {
  return value ? (STAGE_BY_PARAM[value] ?? null) : null
}

export function experimentStageSearchParams(
  current: URLSearchParams,
  stage: ExperimentStage
) {
  const next = new URLSearchParams(current)
  next.set("stage", STAGE_PARAM_BY_STAGE[stage])
  return next
}

export function experimentRunSearchParams(
  current: URLSearchParams,
  runId: string
) {
  const next = new URLSearchParams(current)
  next.set("runId", runId)
  return next
}
