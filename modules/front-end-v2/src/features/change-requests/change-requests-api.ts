import { fetchApi } from "@/lib/api/authenticated-api"
import type { FlagTargeting } from "@/features/flags/flags-types"
import type {
  ChangeRequestFilters,
  ChangeRequestMember,
  ChangeRequestPage,
  ChangeRequestAction,
} from "./change-requests-types"

function changeRequestsPath(envId: string, suffix = "") {
  return `/api/v1/envs/${encodeURIComponent(envId)}/change-requests${suffix}`
}

export function fetchChangeRequests(
  envId: string,
  filters: ChangeRequestFilters,
  pageIndex: number,
  pageSize: number
) {
  const params = new URLSearchParams({
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
  })

  if (filters.query) params.set("query", filters.query)
  if (filters.creatorId) params.set("creatorId", filters.creatorId)
  if (filters.reviewerId) params.set("reviewerId", filters.reviewerId)
  if (filters.status) params.set("status", filters.status)

  return fetchApi<ChangeRequestPage>(`${changeRequestsPath(envId)}?${params}`)
}

export function fetchChangeRequestMembers(searchText: string) {
  const params = new URLSearchParams({
    searchText,
    pageIndex: "0",
    pageSize: "20",
  })

  return fetchApi<{ items: ChangeRequestMember[]; totalCount: number }>(
    `/api/v1/members?${params}`
  )
}

export function createChangeRequest(
  envId: string,
  key: string,
  input: {
    targeting: FlagTargeting
    revision: string
    reviewers: string[]
    reason: string
  }
) {
  return fetchApi<boolean>(
    changeRequestsPath(envId, `/${encodeURIComponent(key)}`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  )
}

export function performChangeRequestAction(
  envId: string,
  id: string,
  action: ChangeRequestAction
) {
  return fetchApi<boolean>(
    changeRequestsPath(envId, `/${encodeURIComponent(id)}/${action}`),
    { method: "PUT" }
  )
}

export function deleteChangeRequest(envId: string, id: string) {
  return fetchApi<boolean>(
    changeRequestsPath(envId, `/${encodeURIComponent(id)}`),
    { method: "DELETE" }
  )
}
