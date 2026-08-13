import { fetchApi } from "@/lib/api/authenticated-api"
import type { Policy } from "../policy-api"
import type { PolicyResource, PolicyStatement } from "./permission-model"

export type PolicyDetail = Policy & {
  statements?: PolicyStatement[]
}

export type PolicyMember = {
  id: string
  name: string
  email: string
  isPolicyMember: boolean
}

export type PolicyGroup = {
  id: string
  name: string
  description?: string
  isPolicyGroup: boolean
}

export type RelationshipOption = {
  id: string
  name: string
  email?: string
  description?: string
}

export type RelationshipOptionPage = {
  items: RelationshipOption[]
  hasMore: boolean
}

export type PagedResult<T> = {
  totalCount: number
  items: T[]
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

function policyPath(policyId: string, suffix = "") {
  return `/api/v1/policies/${encodeURIComponent(policyId)}${suffix}`
}

function putRelationship(path: string) {
  return fetchApi<boolean>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
}

export function fetchPolicyDetail(policyId: string) {
  return fetchApi<PolicyDetail>(policyPath(policyId))
}

export function updatePolicySettings(
  policy: Pick<PolicyDetail, "id" | "name" | "description">
) {
  return fetchApi<PolicyDetail>(policyPath(policy.id, "/settings"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: policy.name,
      description: policy.description ?? "",
    }),
  })
}

export function updatePolicyStatements(
  policyId: string,
  statements: PolicyStatement[]
) {
  return fetchApi<PolicyDetail>(policyPath(policyId, "/statements"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(statements),
  })
}

export function fetchPolicyResources(name: string, type: string) {
  return fetchApi<PolicyResource[]>(
    `/api/v1/resources${queryString({ name, type })}`
  )
}

export function clonePolicy(
  originPolicyKey: string,
  payload: {
    originPolicyType: string
    name: string
    key: string
    description: string
  }
) {
  return fetchApi<Policy>(
    `/api/v1/policies/clone/${encodeURIComponent(originPolicyKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export function removePolicy(policyId: string) {
  return fetchApi<boolean>(policyPath(policyId), { method: "DELETE" })
}

export function fetchPolicyMembers(
  policyId: string,
  params: {
    searchText: string
    getAllMembers: boolean
    pageIndex: number
    pageSize: number
  }
) {
  return fetchApi<PagedResult<PolicyMember>>(
    policyPath(policyId, `/members${queryString(params)}`)
  )
}

export function fetchPolicyGroups(
  policyId: string,
  params: {
    name: string
    getAllGroups: boolean
    pageIndex: number
    pageSize: number
  }
) {
  return fetchApi<PagedResult<PolicyGroup>>(
    policyPath(policyId, `/groups${queryString(params)}`)
  )
}

export async function fetchAvailableMembers(
  policyId: string,
  query: string,
  pageIndex: number
): Promise<RelationshipOptionPage> {
  const pageSize = 10
  const result = await fetchPolicyMembers(policyId, {
    searchText: query,
    getAllMembers: true,
    pageIndex,
    pageSize,
  })
  return {
    items: result.items
      .filter((member) => !member.isPolicyMember)
      .map((member) => ({
        id: member.id,
        name: member.name || member.email,
        email: member.email,
      })),
    hasMore: (pageIndex + 1) * pageSize < result.totalCount,
  }
}

export async function fetchAvailableGroups(
  policyId: string,
  query: string,
  pageIndex: number
): Promise<RelationshipOptionPage> {
  const pageSize = 10
  const result = await fetchPolicyGroups(policyId, {
    name: query,
    getAllGroups: true,
    pageIndex,
    pageSize,
  })
  return {
    items: result.items
      .filter((group) => !group.isPolicyGroup)
      .map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
      })),
    hasMore: (pageIndex + 1) * pageSize < result.totalCount,
  }
}

export function addPolicyToMembers(policyId: string, memberIds: string[]) {
  return Promise.all(
    memberIds.map((memberId) =>
      putRelationship(
        `/api/v1/members/${encodeURIComponent(memberId)}/add-policy/${encodeURIComponent(policyId)}`
      )
    )
  )
}

export function removePolicyFromMember(policyId: string, memberId: string) {
  return putRelationship(
    `/api/v1/members/${encodeURIComponent(memberId)}/remove-policy/${encodeURIComponent(policyId)}`
  )
}

export function addPolicyToGroups(policyId: string, groupIds: string[]) {
  return Promise.all(
    groupIds.map((groupId) =>
      putRelationship(
        `/api/v1/groups/${encodeURIComponent(groupId)}/add-policy/${encodeURIComponent(policyId)}`
      )
    )
  )
}

export function removePolicyFromGroup(policyId: string, groupId: string) {
  return putRelationship(
    `/api/v1/groups/${encodeURIComponent(groupId)}/remove-policy/${encodeURIComponent(policyId)}`
  )
}
