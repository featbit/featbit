import type { Project } from "@/features/layout/layout-types"
import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  EnvironmentResource,
  PagedWebhookDeliveries,
  PagedWebhooks,
  Webhook,
  WebhookDelivery,
  WebhookPayload,
  WebhookTestRequest,
} from "./webhook-types"

const basePath = "/api/v1/webhooks"

export function fetchWebhooks(input: {
  name: string
  projectId: string
  pageIndex: number
  pageSize: number
}) {
  const params = new URLSearchParams({
    name: input.name,
    projectId: input.projectId,
    envId: "",
    pageIndex: String(input.pageIndex),
    pageSize: String(input.pageSize),
  })
  return fetchApi<PagedWebhooks>(`${basePath}?${params}`)
}

export function fetchWebhookProjects() {
  return fetchApi<Project[]>("/api/v1/projects")
}

export function fetchWebhookEnvironmentResources() {
  const params = new URLSearchParams({ spaceLevel: "organization", name: "" })
  params.append("types", "env")
  return fetchApi<EnvironmentResource[]>(`/api/v2/resources?${params}`).then(
    (resources) => resources.filter((resource) => !resource.rn.includes("*"))
  )
}

export function isWebhookNameUsed(name: string) {
  return fetchApi<boolean>(
    `${basePath}/is-name-used?name=${encodeURIComponent(name)}`
  )
}

export function createWebhook(payload: WebhookPayload) {
  return fetchApi<Webhook>(basePath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function updateWebhook(id: string, payload: WebhookPayload) {
  return fetchApi<Webhook>(`${basePath}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function removeWebhook(id: string) {
  return fetchApi<boolean>(`${basePath}/${id}`, { method: "DELETE" })
}

export function sendTestWebhook(request: WebhookTestRequest) {
  return fetchApi<WebhookDelivery>(`${basePath}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
}

export function fetchWebhookDeliveries(input: {
  webhookId: string
  event: string
  success?: boolean
  pageIndex: number
  pageSize: number
}) {
  const params = new URLSearchParams({
    event: input.event,
    pageIndex: String(input.pageIndex),
    pageSize: String(input.pageSize),
  })
  if (input.success !== undefined) {
    params.set("success", String(input.success))
  }
  return fetchApi<PagedWebhookDeliveries>(
    `${basePath}/${input.webhookId}/deliveries?${params}`
  )
}
