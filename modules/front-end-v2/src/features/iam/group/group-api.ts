import { fetchApi } from "@/lib/api/authenticated-api"

export type PagedResult<T> = {
  totalCount: number
  items: T[]
}

export type Group = {
  id: string
  name: string
  resourceName?: string
  description?: string
  updatedAt?: string
}

export type GroupMember = {
  id: string
  name: string
  email: string
  isGroupMember: boolean
}

export type GroupPolicy = {
  id: string
  key?: string
  name: string
  type: string
  description?: string
  isGroupPolicy: boolean
}

export type RelationshipOption = {
  id: string
  name: string
  email?: string
  description?: string
  type?: string
}

export type RelationshipOptionPage = {
  items: RelationshipOption[]
  hasMore: boolean
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

function groupPath(groupId: string, suffix = "") {
  return `/api/v1/groups/${encodeURIComponent(groupId)}${suffix}`
}

export function groupResourceName(group: Pick<Group, "name">) {
  return `group/${group.name}`
}

export function memberResourceName(member: Pick<GroupMember, "email">) {
  return `member/${member.email}`
}

export function policyResourceName(policy: Pick<GroupPolicy, "id" | "key">) {
  return `policy/${policy.key || policy.id}`
}

export function fetchGroups(params: {
  name: string
  pageIndex: number
  pageSize: number
}) {
  return fetchApi<PagedResult<Group>>(`/api/v1/groups${queryString(params)}`)
}

export function fetchGroup(groupId: string) {
  return fetchApi<Group>(groupPath(groupId))
}

export function isGroupNameUsed(name: string) {
  return fetchApi<boolean>(
    `/api/v1/groups/is-name-used${queryString({ name })}`
  )
}

export function createGroup(payload: { name: string; description: string }) {
  return fetchApi<Group>("/api/v1/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function updateGroup(group: Pick<Group, "id" | "name" | "description">) {
  return fetchApi<Group>(groupPath(group.id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: group.name,
      description: group.description ?? "",
    }),
  })
}

export function deleteGroup(groupId: string) {
  return fetchApi<boolean>(groupPath(groupId), { method: "DELETE" })
}

export function fetchGroupMembers(
  groupId: string,
  params: {
    searchText: string
    getAllMembers: boolean
    pageIndex: number
    pageSize: number
  }
) {
  return fetchApi<PagedResult<GroupMember>>(
    groupPath(groupId, `/members${queryString(params)}`)
  )
}

export function fetchGroupPolicies(
  groupId: string,
  params: {
    name: string
    getAllPolicies: boolean
    pageIndex: number
    pageSize: number
  }
) {
  return fetchApi<PagedResult<GroupPolicy>>(
    groupPath(groupId, `/policies${queryString(params)}`)
  )
}

export async function fetchAvailableMembers(
  groupId: string,
  query: string,
  pageIndex: number
): Promise<RelationshipOptionPage> {
  const pageSize = 10
  const result = await fetchGroupMembers(groupId, {
    searchText: query,
    getAllMembers: true,
    pageIndex,
    pageSize,
  })
  return {
    items: result.items
      .filter((member) => !member.isGroupMember)
      .map((member) => ({ ...member, name: member.name || member.email })),
    hasMore: (pageIndex + 1) * pageSize < result.totalCount,
  }
}

export async function fetchAvailablePolicies(
  groupId: string,
  query: string,
  pageIndex: number
): Promise<RelationshipOptionPage> {
  const pageSize = 10
  const result = await fetchGroupPolicies(groupId, {
    name: query,
    getAllPolicies: true,
    pageIndex,
    pageSize,
  })
  return {
    items: result.items.filter((policy) => !policy.isGroupPolicy),
    hasMore: (pageIndex + 1) * pageSize < result.totalCount,
  }
}

function putRelationship(groupId: string, suffix: string) {
  return fetchApi<boolean>(groupPath(groupId, suffix), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
}

export function addMembersToGroup(groupId: string, memberIds: string[]) {
  return Promise.all(
    memberIds.map((memberId) =>
      putRelationship(groupId, `/add-member/${encodeURIComponent(memberId)}`)
    )
  )
}

export function removeMemberFromGroup(groupId: string, memberId: string) {
  return putRelationship(
    groupId,
    `/remove-member/${encodeURIComponent(memberId)}`
  )
}

export function addPoliciesToGroup(groupId: string, policyIds: string[]) {
  return Promise.all(
    policyIds.map((policyId) =>
      putRelationship(groupId, `/add-policy/${encodeURIComponent(policyId)}`)
    )
  )
}

export function removePolicyFromGroup(groupId: string, policyId: string) {
  return putRelationship(
    groupId,
    `/remove-policy/${encodeURIComponent(policyId)}`
  )
}
