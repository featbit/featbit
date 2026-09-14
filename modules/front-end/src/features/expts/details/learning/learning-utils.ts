import type { ExperimentRunDetail } from "../experiment-details-types"

export const LEARNING_FIELDS = [
  "whatChanged",
  "whatHappened",
  "confirmedOrRefuted",
  "whyItHappened",
  "nextHypothesis",
] as const

export type LearningField = (typeof LEARNING_FIELDS)[number]

export function orderExperimentRuns(runs: ExperimentRunDetail[]) {
  return [...runs].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt)
    return createdComparison || left.id.localeCompare(right.id)
  })
}

export function hasCapturedLearning(run: ExperimentRunDetail) {
  return LEARNING_FIELDS.some((field) => Boolean(run[field]?.trim()))
}

export function normalizedDecision(decision: string | null) {
  return (
    decision?.trim().toUpperCase().replaceAll("_", " ").replaceAll("-", " ") ??
    ""
  )
}
