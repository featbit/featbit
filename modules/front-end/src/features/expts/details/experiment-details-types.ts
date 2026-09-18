import type { ExperimentStage } from "../index/experiment-types"
import type {
  GuardrailMetricConfig,
  PrimaryMetricConfig,
} from "./metric-config-types"

export type ExperimentDetail = {
  id: string
  name: string
  description: string | null
  stage: ExperimentStage
  flagId: string | null
  flagKey: string | null
  flagName: string | null
  envId: string | null
  runCount: number
  hypothesis: string | null
  goal: string | null
  intent: string | null
  change: string | null
  constraints: string | null
  conflictAnalysis: string | null
  variants?: string | null
  lastLearning: string | null
  primaryMetric: PrimaryMetricConfig | null
  guardrailMetrics: GuardrailMetricConfig[] | null
  experimentRuns: ExperimentRunDetail[]
  createdAt: string
  updatedAt: string
}

export type ExperimentRunDetail = {
  id: string
  slug: string
  method: string | null
  observationStart?: string | null
  observationEnd?: string | null
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
  primaryMetric: {
    metricId: string
    expectedDirection: "increase_good" | "decrease_good"
  }
  guardrailMetrics: {
    metricId: string
    direction: "increase_bad" | "decrease_bad"
  }[]
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
  expires_at: string
}
