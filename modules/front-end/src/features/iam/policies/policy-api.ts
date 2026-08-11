import { fetchApi } from "@/lib/api/authenticated-api"

export type PolicyType = "SysManaged" | "CustomerManaged"

export type Policy = {
  id: string
  key: string
  name: string
  type: PolicyType | string
  description?: string
  updatedAt?: string
}

export type PagedPolicies = {
  totalCount: number
  items: Policy[]
}

function queryString(params: Record<string, string | number | undefined>) {
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

export function policyResourceName(policy: Pick<Policy, "id" | "key">) {
  return `policy/${policy.key || policy.id}`
}

export function fetchPolicies(params: {
  name: string
  pageIndex: number
  pageSize: number
}) {
  return fetchApi<PagedPolicies>(`/api/v1/policies${queryString(params)}`)
}

export function isPolicyKeyUsed(key: string) {
  return fetchApi<boolean>(
    `/api/v1/policies/is-key-used${queryString({ key })}`
  )
}

export function createPolicy(payload: {
  name: string
  key: string
  description: string
}) {
  return fetchApi<Policy>("/api/v1/policies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function deletePolicy(policyId: string) {
  return fetchApi<boolean>(policyPath(policyId), { method: "DELETE" })
}
