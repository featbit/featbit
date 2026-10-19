import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  AuditLogFilters,
  AuditUser,
  PagedAuditLogs,
} from "./audit-logs-types"

export function fetchAuditLogs(
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

  if (filters.envId) params.set("envId", filters.envId)

  return fetchApi<PagedAuditLogs>(`/api/v1/audit-logs?${params}`)
}

export function fetchAuditUsers(
  searchText: string,
  scope?: Pick<AuditLogFilters, "envId" | "refType" | "refId">
) {
  const params = new URLSearchParams({
    query: searchText,
    pageIndex: "0",
    pageSize: "20",
  })

  if (scope?.envId) params.set("envId", scope.envId)
  if (scope?.refType) params.set("refType", scope.refType)
  if (scope?.refId) params.set("refId", scope.refId)
  return fetchApi<{ items: AuditUser[]; totalCount: number }>(
    `/api/v1/audit-logs/actors?${params}`
  )
}
