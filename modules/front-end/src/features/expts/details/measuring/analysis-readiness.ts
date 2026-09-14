import type { ExperimentDetail } from "../experiment-details-types"
import { parsePrimaryMetric } from "../exposure/exposure-utils"
import type { MeasuringRun, ParsedAnalysis } from "./measuring-types"

export function analysisBlocker(
  experiment: ExperimentDetail,
  run: MeasuringRun
) {
  const control = run.controlVariant?.trim()
  const treatments = (run.treatmentVariant ?? "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean)
  const method = run.method?.trim().toLowerCase()
  if (
    !experiment.flagKey?.trim() ||
    !(
      run.primaryMetricEvent?.trim() ||
      parsePrimaryMetric(experiment.primaryMetric)?.key
    ) ||
    method !== "bayesian_ab" ||
    !control ||
    !treatments.length ||
    treatments.includes(control) ||
    new Set(treatments).size !== treatments.length
  )
    return "analysisNeedsConfiguration"

  const start = run.observationStart ? Date.parse(run.observationStart) : NaN
  const end = run.observationEnd == null ? null : Date.parse(run.observationEnd)
  if (
    !Number.isFinite(start) ||
    (end !== null && (!Number.isFinite(end) || end <= start))
  ) {
    return "analysisNeedsWindow"
  }
  return null
}

export function analysisWindowChanged(
  run: MeasuringRun,
  analysis: ParsedAnalysis
) {
  if (!analysis.window) return false
  const time = (value: string | null | undefined) =>
    value ? Date.parse(value) : null
  return (
    time(run.observationStart) !== time(analysis.window.start) ||
    time(run.observationEnd) !== time(analysis.window.end)
  )
}
