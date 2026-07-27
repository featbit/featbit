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
