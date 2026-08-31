import type { ExperimentStage } from "../index/experiment-types"

export type ExperimentDetail = {
  id: string
  name: string
  description: string | null
  stage: ExperimentStage
  flagKey: string | null
  featBitProjectKey: string | null
  featBitEnvId: string | null
  runCount: number
  hypothesis: string | null
  goal: string | null
  intent: string | null
  change: string | null
  constraints: string | null
  conflictAnalysis: string | null
  lastLearning: string | null
  primaryMetric: string | null
  guardrails: string | null
  experimentRuns: ExperimentRunDetail[]
  createdAt: string
  updatedAt: string
}

export type ExperimentRunDetail = {
  id: string
  slug: string
  status: string
  method: string | null
  decision: string | null
  decisionSummary: string | null
  decisionReason: string | null
  whatChanged: string | null
  whatHappened: string | null
  confirmedOrRefuted: string | null
  whyItHappened: string | null
  nextHypothesis: string | null
  createdAt: string
}

export type ExperimentMetricsUpdate = {
  metricId: string
  metricKey: string
  expectedDirection: "increase_good" | "decrease_good"
  guardrails: string
}

export type ExperimentDetailsUpdate = Pick<
  ExperimentDetail,
  "description" | "goal" | "intent" | "hypothesis" | "change" | "constraints"
>

export type ExperimentLearningUpdate = Pick<
  ExperimentDetail,
  "hypothesis" | "lastLearning"
>

export type McpTokenResponse = {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  scope?: string
}

export type StoredMcpToken = McpTokenResponse & {
  created_at: string
  expires_at: string
}
