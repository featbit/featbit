import { fetchApi } from "@/lib/api/authenticated-api"
import type { PagedResult, TeamMember } from "../team-api"

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

export async function fetchMemberDirectPolicies(
  memberId: string,
  params: { name: string; pageIndex: number; pageSize: number }
) {
  const [result, resources] = await Promise.all([
    fetchApi<PagedResult<MemberDirectPolicy>>(
      memberPath(
        memberId,
        `/direct-policies${queryString({
          name: params.name,
          getAllPolicies: false,
          pageIndex: params.pageIndex,
          pageSize: params.pageSize,
        })}`
      )
    ),
    fetchApi<MemberPolicyResource[]>(memberPath(memberId, "/policies")),
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
    fetchApi<PagedResult<MemberInheritedPolicy>>(
      memberPath(
        memberId,
        `/inherited-policies${queryString({
          name: params.name,
          pageIndex: params.pageIndex,
          pageSize: params.pageSize,
        })}`
      )
    ),
    fetchApi<MemberPolicyResource[]>(memberPath(memberId, "/policies")),
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

export function removeMemberFromOrganization(memberId: string) {
  return fetchApi<boolean>(
    `/api/v1/members/remove-from-org/${encodeURIComponent(memberId)}`,
    { method: "DELETE" }
  )
}
