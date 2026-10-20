import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  AuditLogFilters,
  AuditUser,
  PagedAuditLogs,
} from "./audit-logs-types"

export function fetchAuditLogs(
  envId: string,
  filters: AuditLogFilters,
  pageIndex: number,
  pageSize: number
) {
  const params = new URLSearchParams({
    crossEnvironment: String(filters.crossEnvironment ?? false),
    query: filters.query,
    creatorId: filters.creatorId ?? "",
    refType: filters.refType ?? "",
    refId: filters.refId ?? "",
    from: filters.from ? String(filters.from) : "",
    to: filters.to ? String(filters.to) : "",
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
  })

  return fetchApi<PagedAuditLogs>(
    `/api/v1/envs/${encodeURIComponent(envId)}/audit-logs?${params}`
  )
}

export function fetchAuditUsers(searchText: string) {
  const params = new URLSearchParams({
    searchText,
    pageIndex: "0",
    pageSize: "20",
  })

  return fetchApi<{ items: AuditUser[]; totalCount: number }>(
    `/api/v1/members?${params}`
  )
}

export function fetchIamAuditLogs(
  filters: AuditLogFilters,
  pageIndex: number,
  pageSize: number
) {
  const params = new URLSearchParams({
    query: filters.query,
    creatorId: filters.creatorId ?? "",
    refType: filters.refType ?? "",
    refId: filters.refId ?? "",
    from: filters.from ? String(filters.from) : "",
    to: filters.to ? String(filters.to) : "",
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
  })

  return fetchApi<PagedAuditLogs>(`/api/v1/iam/audit-logs?${params}`)
}

export function fetchIamAuditUsers(
  searchText: string,
  scope?: Pick<AuditLogFilters, "refType" | "refId">
) {
  const params = new URLSearchParams({
    query: searchText,
    pageIndex: "0",
    pageSize: "20",
  })

  if (scope?.refType) params.set("refType", scope.refType)
  if (scope?.refId) params.set("refId", scope.refId)
  return fetchApi<{ items: AuditUser[] }>(
    `/api/v1/iam/audit-logs/actors?${params}`
  )
}
