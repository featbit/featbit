import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  UsageSummary,
  WorkspaceUsage,
  WorkspaceUsageFilter,
} from "./usage-types"

const emptySummary: UsageSummary = {
  uniqueUsers: 0,
  totalFlagEvaluations: 0,
  totalCustomMetrics: 0,
  prevUniqueUsers: 0,
  prevFlagEvaluations: 0,
  prevCustomMetrics: 0,
}

function normalizeUsage(value: WorkspaceUsage | null | undefined) {
  return {
    summary: value?.summary ?? emptySummary,
    dailyTrend: value?.dailyTrend ?? [],
    environmentUsages: value?.environmentUsages ?? [],
  }
}

export async function fetchWorkspaceUsage(filter: WorkspaceUsageFilter) {
  const params = new URLSearchParams(filter)
  const usage = await fetchApi<WorkspaceUsage | null>(
    `/api/v1/workspaces/usages?${params.toString()}`
  )

  return normalizeUsage(usage)
}
