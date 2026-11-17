import { fetchApi } from "@/lib/api/authenticated-api"
import type { AuditLogQueryFilter, PagedAuditLogs } from "./audit-logs-types"

export function fetchAuditLogs(
  filter: AuditLogQueryFilter,
  pageIndex: number,
  pageSize: number
) {
  const params = new URLSearchParams({
    scope: filter.scope,
    scopeId: filter.scopeId,
    crossEnvironment: String(filter.crossEnvironment ?? false),
    query: filter.query ?? "",
    creatorId: filter.creatorId ?? "",
    refId: filter.refId ?? "",
    from: filter.from !== undefined ? String(filter.from) : "",
    to: filter.to !== undefined ? String(filter.to) : "",
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
  })

  for (const refType of filter.refTypes ?? []) {
    params.append("refTypes", refType)
  }

  return fetchApi<PagedAuditLogs>(`/api/v1/audit-logs?${params}`)
}
