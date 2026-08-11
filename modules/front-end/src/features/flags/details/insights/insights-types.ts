export type InsightsPeriod =
  "30m" | "2H" | "24H" | "7D" | "14D" | "1M" | "2M" | "6M" | "12M"

export type InsightsInterval = "MINUTE" | "HOUR" | "DAY" | "WEEK" | "MONTH"

export type VariationInsight = {
  variation: string
  count: number
}

export type FeatureFlagInsight = {
  time: string
  variations: VariationInsight[]
}

export type EvaluatedEndUser = {
  variation: string
  keyId: string
  name?: string | null
  lastEvaluatedAt: string
}

export type EvaluatedEndUsersPage = {
  totalCount: number
  items: EvaluatedEndUser[]
}

export type InsightRange = {
  from: number
  to: number
}
