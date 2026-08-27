import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  EvaluatedEndUsersPage,
  FeatureFlagInsight,
  InsightRange,
  InsightsInterval,
} from "./insights-types"

function queryString(values: Record<string, string | number>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    params.set(key, String(value))
  }
  return params.toString()
}

export function fetchFeatureFlagInsights(
  envId: string,
  input: InsightRange & {
    featureFlagKey: string
    intervalType: InsightsInterval
  }
) {
  const params = queryString({
    ...input,
    timezone: getTimezoneString(),
  })
  return fetchApi<FeatureFlagInsight[]>(
    `/api/v1/envs/${encodeURIComponent(envId)}/feature-flags/insights?${params}`
  )
}

export function fetchEvaluatedEndUsers(
  envId: string,
  input: InsightRange & {
    featureFlagKey: string
    variationId: string
    query: string
    pageIndex: number
    pageSize: number
  }
) {
  const params = queryString({ ...input, pageIndex: input.pageIndex - 1 })
  return fetchApi<EvaluatedEndUsersPage>(
    `/api/v1/envs/${encodeURIComponent(envId)}/end-users/stats?${params}`
  )
}

function getTimezoneString() {
  const offset = -new Date().getTimezoneOffset() / 60
  return `Etc/GMT${offset >= 0 ? "-" : "+"}${Math.abs(offset)}`
}
