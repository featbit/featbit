import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  AgentAvailability,
  EnvironmentResource,
  PagedRelayProxies,
  RelayProxy,
  RelayProxyPayload,
  SyncAgentResult,
  UserPolicy,
} from "./relay-proxy-types"

const basePath = "/api/v1/relay-proxies"

export function fetchRelayProxies(input: {
  name: string
  pageIndex: number
  pageSize: number
}) {
  const params = new URLSearchParams({
    name: input.name,
    pageIndex: String(input.pageIndex),
    pageSize: String(input.pageSize),
  })
  return fetchApi<PagedRelayProxies>(`${basePath}?${params}`)
}

export function isRelayProxyNameUsed(name: string) {
  return fetchApi<boolean>(
    `${basePath}/is-name-used?name=${encodeURIComponent(name)}`
  )
}

export function createRelayProxy(payload: RelayProxyPayload) {
  return fetchApi<RelayProxy>(basePath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function updateRelayProxy(id: string, payload: RelayProxyPayload) {
  return fetchApi<boolean>(`${basePath}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function removeRelayProxy(id: string) {
  return fetchApi<boolean>(`${basePath}/${id}`, { method: "DELETE" })
}

export function checkAgentAvailability(host: string) {
  return fetchApi<AgentAvailability>(
    `${basePath}/agent-availability?agentHost=${encodeURIComponent(host)}`
  )
}

export function syncRelayProxyAgent(
  relayProxyId: string,
  agentId: string,
  host: string
) {
  return fetchApi<SyncAgentResult>(
    `${basePath}/${relayProxyId}/agents/${agentId}/sync?host=${encodeURIComponent(host)}`,
    { method: "PUT" }
  )
}

export function fetchEnvironmentResources(name = "") {
  const params = new URLSearchParams({
    spaceLevel: "organization",
    name,
  })
  params.append("types", "env")
  return fetchApi<EnvironmentResource[]>(`/api/v2/resources?${params}`).then(
    (resources) => resources.filter((resource) => !resource.rn.includes("*"))
  )
}

export function fetchCurrentUserPolicies() {
  return fetchApi<UserPolicy[]>("/api/v1/user/policies")
}
