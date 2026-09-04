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
  items: ExperimentListItem[]
  totalCount: number
}

export type CreateExperimentPayload = {
  name: string
  description: string | null
  featBitProjectKey: string
}
