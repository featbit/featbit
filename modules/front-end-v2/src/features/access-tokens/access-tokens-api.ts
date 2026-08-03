import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  AccessToken,
  AccessTokenPayload,
  PagedAccessTokens,
  PolicyResource,
  UserPolicy,
} from "./access-token-types"

type PagedCreators = {
  totalCount: number
  items: Array<{
    id: string
    name?: string
    email?: string
  }>
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

function accessTokenPath(id: string, suffix = "") {
  return `/api/v1/access-tokens/${encodeURIComponent(id)}${suffix}`
}

export function fetchAccessTokens(params: {
  name: string
  creatorId: string
  type: string
  pageIndex: number
  pageSize: number
}) {
  return fetchApi<PagedAccessTokens>(
    `/api/v1/access-tokens${queryString(params)}`
  )
}

export function isAccessTokenNameUsed(name: string) {
  return fetchApi<boolean>(
    `/api/v1/access-tokens/is-name-used${queryString({ name })}`
  )
}

export function createAccessToken(payload: AccessTokenPayload) {
  return fetchApi<AccessToken>("/api/v1/access-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function updateAccessToken(
  id: string,
  payload: Pick<AccessTokenPayload, "name" | "permissions">
) {
  return fetchApi<AccessToken>(accessTokenPath(id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function removeAccessToken(id: string) {
  return fetchApi<boolean>(accessTokenPath(id), { method: "DELETE" })
}

export function toggleAccessTokenStatus(id: string) {
  return fetchApi<unknown>(accessTokenPath(id, "/toggle"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
}

export function fetchAccessTokenCreators(searchText: string) {
  return fetchApi<PagedCreators>(
    `/api/v1/members${queryString({
      searchText,
      pageIndex: 0,
      pageSize: 20,
    })}`
  )
}

export function fetchAccessTokenResources(name: string, type: string) {
  return fetchApi<PolicyResource[]>(
    `/api/v1/resources${queryString({ name, type })}`
  )
}

export function fetchCurrentUserPolicies() {
  return fetchApi<UserPolicy[]>("/api/v1/user/policies")
}
