import { queryOptions } from "@tanstack/react-query"
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

export type MemberDetailGroup = {
  id: string
  name: string
  description?: string
  isGroupMember: boolean
}

export type MemberDirectPolicy = {
  id: string
  key?: string
  name: string
  type: string
  description?: string
  isMemberPolicy: boolean
}

export type MemberInheritedPolicy = {
  id: string
  key?: string
  name: string
  type: string
  description?: string
  groupName: string
}

export type RelationshipOption = {
  id: string
  name: string
  description?: string
  type?: string
}

export type RelationshipOptionPage = {
  items: RelationshipOption[]
  hasMore: boolean
}

type MemberPolicyResource = {
  id: string
  key: string
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

function memberPath(memberId: string, suffix = "") {
  return `/api/v1/members/${encodeURIComponent(memberId)}${suffix}`
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

export const teamQueryKeys = {
  memberLists: (organizationId: string) =>
    ["iam", "team", organizationId] as const,
  members: (
    organizationId: string,
    params: { searchText: string; pageIndex: number; pageSize: number }
  ) =>
    [
      ...teamQueryKeys.memberLists(organizationId),
      params.searchText,
      params.pageIndex,
      params.pageSize,
    ] as const,
}

export function teamMembersQueryOptions(
  organizationId: string,
  params: { searchText: string; pageIndex: number; pageSize: number }
) {
  return queryOptions({
    queryKey: teamQueryKeys.members(organizationId, params),
    queryFn: () => fetchTeamMembers(params),
    staleTime: 60_000,
  })
}

export function addTeamMember(payload: AddMemberPayload) {
  return fetchApi<boolean>("/api/v1/members/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function removeMemberFromOrganization(memberId: string) {
  return fetchApi<boolean>(
    `/api/v1/members/remove-from-org/${encodeURIComponent(memberId)}`,
    { method: "DELETE" }
  )
}

export function removeMemberFromWorkspace(memberId: string) {
  return fetchApi<boolean>(
    `/api/v1/members/remove-from-workspace/${memberId}`,
    { method: "DELETE" }
  )
}

export function fetchPolicyOptions(params: {
  name: string
  pageIndex: number
}) {
  return fetchApi<PagedResult<PolicyOption>>(
    `/api/v1/policies${queryString({
      name: params.name,
      pageIndex: params.pageIndex,
      pageSize: 10,
    })}`
  )
}

export function fetchGroupOptions(params: { name: string; pageIndex: number }) {
  return fetchApi<PagedResult<GroupOption>>(
    `/api/v1/groups${queryString({
      name: params.name,
      pageIndex: params.pageIndex,
      pageSize: 10,
    })}`
  )
}

export function fetchMemberDetail(memberId: string) {
  return fetchApi<TeamMember>(memberPath(memberId))
}

export function fetchMemberGroups(
  memberId: string,
  params: { name: string; pageIndex: number; pageSize: number }
) {
  return fetchApi<PagedResult<MemberDetailGroup>>(
    memberPath(
      memberId,
      `/groups${queryString({
        name: params.name,
        getAllGroups: false,
        pageIndex: params.pageIndex,
        pageSize: params.pageSize,
      })}`
    )
  )
}

function fetchMemberDirectPolicyPage(
  memberId: string,
  params: { name: string; pageIndex: number; pageSize: number }
) {
  return fetchApi<PagedResult<MemberDirectPolicy>>(
    memberPath(
      memberId,
      `/direct-policies${queryString({
        name: params.name,
        getAllPolicies: false,
        pageIndex: params.pageIndex,
        pageSize: params.pageSize,
      })}`
    )
  )
}

function fetchMemberInheritedPolicyPage(
  memberId: string,
  params: { name: string; pageIndex: number; pageSize: number }
) {
  return fetchApi<PagedResult<MemberInheritedPolicy>>(
    memberPath(
      memberId,
      `/inherited-policies${queryString({
        name: params.name,
        pageIndex: params.pageIndex,
        pageSize: params.pageSize,
      })}`
    )
  )
}

function fetchMemberPolicyResources(memberId: string) {
  return fetchApi<MemberPolicyResource[]>(memberPath(memberId, "/policies"))
}

export async function fetchMemberDirectPolicies(
  memberId: string,
  params: { name: string; pageIndex: number; pageSize: number }
) {
  const [result, resources] = await Promise.all([
    fetchMemberDirectPolicyPage(memberId, params),
    fetchMemberPolicyResources(memberId),
  ])
  const keysById = new Map(resources.map((policy) => [policy.id, policy.key]))

  return {
    ...result,
    items: result.items.map((policy) => ({
      ...policy,
      key: keysById.get(policy.id),
    })),
  }
}

export async function fetchMemberInheritedPolicies(
  memberId: string,
  params: { name: string; pageIndex: number; pageSize: number }
) {
  const [result, resources] = await Promise.all([
    fetchMemberInheritedPolicyPage(memberId, params),
    fetchMemberPolicyResources(memberId),
  ])
  const keysById = new Map(resources.map((policy) => [policy.id, policy.key]))

  return {
    ...result,
    items: result.items.map((policy) => ({
      ...policy,
      key: keysById.get(policy.id),
    })),
  }
}

export async function fetchMemberRelationshipCounts(memberId: string) {
  const countParams = { name: "", pageIndex: 0, pageSize: 1 }
  const [groups, directPolicies, inheritedPolicies] = await Promise.all([
    fetchMemberGroups(memberId, countParams),
    fetchMemberDirectPolicyPage(memberId, countParams),
    fetchMemberInheritedPolicyPage(memberId, countParams),
  ])

  return {
    groups: groups.totalCount,
    direct: directPolicies.totalCount,
    inherited: inheritedPolicies.totalCount,
  }
}

export async function fetchAvailableGroups(
  memberId: string,
  query: string,
  pageIndex: number
): Promise<RelationshipOptionPage> {
  const pageSize = 10
  const result = await fetchApi<PagedResult<MemberDetailGroup>>(
    memberPath(
      memberId,
      `/groups${queryString({
        name: query,
        getAllGroups: true,
        pageIndex,
        pageSize,
      })}`
    )
  )

  return {
    items: result.items.filter((item) => !item.isGroupMember),
    hasMore: (pageIndex + 1) * pageSize < result.totalCount,
  }
}

export async function fetchAvailablePolicies(
  memberId: string,
  query: string,
  pageIndex: number
): Promise<RelationshipOptionPage> {
  const pageSize = 10
  const result = await fetchApi<PagedResult<MemberDirectPolicy>>(
    memberPath(
      memberId,
      `/direct-policies${queryString({
        name: query,
        getAllPolicies: true,
        pageIndex,
        pageSize,
      })}`
    )
  )

  return {
    items: result.items
      .filter((item) => !item.isMemberPolicy)
      .map((item) => ({ ...item, type: item.type })),
    hasMore: (pageIndex + 1) * pageSize < result.totalCount,
  }
}

export function addMemberToGroups(memberId: string, groupIds: string[]) {
  return Promise.all(
    groupIds.map((groupId) =>
      fetchApi<boolean>(
        `/api/v1/groups/${encodeURIComponent(groupId)}/add-member/${encodeURIComponent(memberId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      )
    )
  )
}

export function removeMemberFromGroup(memberId: string, groupId: string) {
  return fetchApi<boolean>(
    `/api/v1/groups/${encodeURIComponent(groupId)}/remove-member/${encodeURIComponent(memberId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  )
}

export function addPoliciesToMember(memberId: string, policyIds: string[]) {
  return Promise.all(
    policyIds.map((policyId) =>
      fetchApi<boolean>(
        memberPath(memberId, `/add-policy/${encodeURIComponent(policyId)}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      )
    )
  )
}

export function removePolicyFromMember(memberId: string, policyId: string) {
  return fetchApi<boolean>(
    memberPath(memberId, `/remove-policy/${encodeURIComponent(policyId)}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  )
}
