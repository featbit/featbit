export type PeriodKey =
  | "currentBilling"
  | "previousBilling"
  | "thisMonth"
  | "last7d"
  | "last30d"

export type MetricKey = "newUsers" | "flagEvaluations" | "customMetrics"

export type WorkspaceUsageFilter = {
  startDate: string
  endDate: string
  prevStartDate: string
  prevEndDate: string
}

export type UsageSummary = {
  uniqueUsers: number
  totalFlagEvaluations: number
  totalCustomMetrics: number
  prevUniqueUsers: number
  prevFlagEvaluations: number
  prevCustomMetrics: number
}

export type DailyTrendItem = {
  date: string
  newUsers: number
  flagEvaluations: number
  customMetrics: number
}

export type EnvironmentUsage = {
  orgName: string
  projectName: string
  envName: string
  envId: string
  uniqueUsers: number
  flagEvaluations: number
  customMetrics: number
}

export type WorkspaceUsage = {
  summary: UsageSummary
  dailyTrend: DailyTrendItem[]
  environmentUsages: EnvironmentUsage[]
}

export type CurrentCycleDates = {
  startDate: Date
  endDate: Date
  rawEndDate: Date
} | null

export type PeriodOption = {
  label: string
  value: PeriodKey
}
