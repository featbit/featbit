export type ExperimentStage =
  "hypothesis" | "implementing" | "measuring" | "learning"

export type ExperimentListItem = {
  id: string
  name: string
  description: string | null
  stage: ExperimentStage
  flagKey: string | null
  featBitProjectKey: string | null
  featBitEnvId: string | null
  runCount: number
  runMethodSummary: string | null
  createdAt: string
  updatedAt: string
}

export type PagedExperiments = {
  items: ExperimentListSummary[]
  totalCount: number
}

export type ExperimentRunStateSummary = {
  id: string
  createdAt: string
  observationStart: string | null
  observationEnd: string | null
  decision: string | null
  hasLearning: boolean
}

export type ExperimentListSummary = ExperimentListItem & {
  stateSummary: {
    hasLearning: boolean
    runs: ExperimentRunStateSummary[]
  }
}

export type CreateExperimentPayload = {
  name: string
  description: string | null
  featBitProjectKey: string
}
