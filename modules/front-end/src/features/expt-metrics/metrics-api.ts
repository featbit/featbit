import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  Metric,
  MetricCreatePayload,
  MetricUpdatePayload,
  PagedMetrics,
} from "./metrics-types"

function metricsPath(envId: string, suffix = "") {
  return `/api/v1/envs/${encodeURIComponent(envId)}/experiment-metrics${suffix}`
}

export function fetchMetrics(
  envId: string,
  input: {
    search: string
    status: "active" | "archived"
    pageIndex: number
    pageSize: number
  }
) {
  const params = new URLSearchParams({
    searchText: input.search,
    status: input.status,
    pageIndex: String(input.pageIndex),
    pageSize: String(input.pageSize),
  })
  return fetchApi<PagedMetrics>(`${metricsPath(envId)}?${params}`)
}

export function createMetric(envId: string, payload: MetricCreatePayload) {
  return fetchApi<Metric>(metricsPath(envId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function updateMetric(
  envId: string,
  metricId: string,
  payload: MetricUpdatePayload
) {
  return fetchApi<Metric>(
    metricsPath(envId, `/${encodeURIComponent(metricId)}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export function archiveMetric(envId: string, metricId: string) {
  return fetchApi<boolean>(
    metricsPath(envId, `/${encodeURIComponent(metricId)}/archive`),
    { method: "PUT" }
  )
}

export function restoreMetric(envId: string, metricId: string) {
  return fetchApi<boolean>(
    metricsPath(envId, `/${encodeURIComponent(metricId)}/restore`),
    { method: "PUT" }
  )
}
