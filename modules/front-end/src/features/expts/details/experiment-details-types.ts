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
  createdAt: string
  updatedAt: string
}

export type ExperimentDetailsUpdate = Pick<
  ExperimentDetail,
  "description" | "goal" | "intent" | "hypothesis" | "change" | "constraints"
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
