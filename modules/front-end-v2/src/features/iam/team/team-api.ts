import { fetchApi } from "@/lib/api/authenticated-api"

export type PagedResult<T> = {
  totalCount: number
  items: T[]
}

export type MemberGroup = {
  id: string
  name: string
  description?: string
  memberId?: string
  isGroupMember?: boolean
}

export type TeamMember = {
  id: string
  email: string
  invitorId?: string
  initialPassword?: string
  groups: MemberGroup[]
  name: string
}

export type PolicyOption = {
  id: string
  name: string
  type: string
  description?: string
}

export type GroupOption = {
  id: string
  name: string
  description?: string
}

export type AddMemberPayload = {
  email: string
  policyIds: string[]
  groupIds: string[]
}

function queryString(
  params: Record<string, string | number | boolean | undefined>
) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value))
    }
  })

  const value = searchParams.toString()
  return value ? `?${value}` : ""
}

export function memberResourceName(member: Pick<TeamMember, "email">) {
  return `member/${member.email}`
}

export function fetchTeamMembers(params: {
  searchText: string
  pageIndex: number
  pageSize: number
}) {
  return fetchApi<PagedResult<TeamMember>>(
    `/api/v1/members${queryString({
      searchText: params.searchText,
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
    })}`
  )
}

export function addTeamMember(payload: AddMemberPayload) {
  return fetchApi<boolean>("/api/v1/members/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function removeMemberFromOrganization(memberId: string) {
  return fetchApi<boolean>(`/api/v1/members/remove-from-org/${memberId}`, {
    method: "DELETE",
  })
}

export function removeMemberFromWorkspace(memberId: string) {
  return fetchApi<boolean>(
    `/api/v1/members/remove-from-workspace/${memberId}`,
    { method: "DELETE" }
  )
}

export function fetchPolicyOptions(params: { name: string }) {
  return fetchApi<PagedResult<PolicyOption>>(
    `/api/v1/policies${queryString({
      name: params.name,
      pageIndex: 0,
      pageSize: 20,
    })}`
  )
}

export function fetchGroupOptions(params: { name: string }) {
  return fetchApi<PagedResult<GroupOption>>(
    `/api/v1/groups${queryString({
      name: params.name,
      pageIndex: 0,
      pageSize: 20,
    })}`
  )
}
