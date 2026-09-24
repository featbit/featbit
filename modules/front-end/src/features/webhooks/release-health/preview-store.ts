import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import {
  getCurrentOrganization,
  getCurrentWorkspace,
} from "@/features/layout/layout-context"
import { fetchApi } from "@/lib/api/authenticated-api"
import { ALERT_PAYLOAD_TEMPLATE, validateAlertTemplate } from "./alert-payload"
import {
  webhookHeadersSchema,
  type WebhookAuthentication,
} from "./webhook-authentication"

export function isPreviewEndpoint(value: string) {
  try {
    const url = new URL(value)
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.hash
    )
  } catch {
    return false
  }
}

const webhookSchema = z.object({
  id: z.string().min(1),
  purpose: z.literal("release-health"),
  name: z.string(),
  url: z.string(),
  isActive: z.boolean(),
  scopes: z.array(z.string()),
  scopeNames: z.array(z.string()),
  payloadTemplateType: z.enum(["default", "custom"]),
  payloadTemplate: z.string(),
  version: z.number().int().positive(),
  hasHeaders: z.boolean(),
  hasSecret: z.boolean(),
  canManage: z.boolean(),
})
export type ReleaseHealthWebhook = z.infer<typeof webhookSchema> &
  WebhookAuthentication
export type ReleaseHealthWebhookDraft = Omit<
  ReleaseHealthWebhook,
  | "id"
  | "purpose"
  | "version"
  | "hasHeaders"
  | "hasSecret"
  | "canManage"
  | "headers"
  | "secret"
> &
  Partial<WebhookAuthentication> & {
    removeSavedHeaders?: boolean
    removeSavedSecret?: boolean
  }

const basePath = "/api/v1/webhooks/release-health"
// Retained export for consumers' React/query identity; it is never a browser storage key.
export function previewStoreKey() {
  const userId = getStoredUserProfile().id
  const workspaceId = getCurrentWorkspace()?.id
  const orgId = getCurrentOrganization()?.id
  return userId && workspaceId && orgId
    ? ["release-health-webhooks", userId, workspaceId, orgId]
        .map(encodeURIComponent)
        .join(":")
    : null
}
function readView(value: unknown): ReleaseHealthWebhook {
  return { ...webhookSchema.parse(value), headers: [], secret: "" }
}
function contextHeaders(owner: string | null) {
  if (!owner || owner !== previewStoreKey()) throw new Error("missing-context")
  return {
    Organization: getCurrentOrganization()!.id,
    Workspace: getCurrentWorkspace()!.id,
  }
}
export async function fetchReleaseHealthWebhooks(): Promise<
  ReleaseHealthWebhook[]
> {
  return z
    .array(webhookSchema)
    .parse(
      await fetchApi<unknown>(basePath, {
        headers: contextHeaders(previewStoreKey()),
      })
    )
    .map(readView)
}
export async function saveReleaseHealthWebhook(
  owner: string,
  draft: ReleaseHealthWebhookDraft,
  previous?: ReleaseHealthWebhook
) {
  if (owner !== previewStoreKey()) throw new Error("missing-context")
  const payloadTemplate =
    draft.payloadTemplateType === "default"
      ? ALERT_PAYLOAD_TEMPLATE
      : draft.payloadTemplate
  if (validateAlertTemplate(payloadTemplate)) throw new Error("template")
  const headers = webhookHeadersSchema
    .parse(draft.headers ?? [])
    .filter((header) => header.key)
  const secret = draft.secret ?? ""
  const payload = {
    name: draft.name.trim(),
    url: draft.url.trim(),
    isActive: draft.isActive,
    scopes: draft.scopes,
    payloadTemplateType: draft.payloadTemplateType,
    payloadTemplate,
    expectedVersion: previous?.version ?? null,
    headersUpdate: headers.length
      ? { operation: "replace", headers }
      : {
          operation: draft.removeSavedHeaders || !previous ? "remove" : "keep",
        },
    secretUpdate: secret
      ? { operation: "replace", secret }
      : { operation: draft.removeSavedSecret || !previous ? "remove" : "keep" },
  }
  return readView(
    await fetchApi<unknown>(
      previous ? `${basePath}/${encodeURIComponent(previous.id)}` : basePath,
      {
        method: previous ? "PUT" : "POST",
        headers: {
          ...contextHeaders(owner),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    )
  )
}
export async function removeReleaseHealthWebhook(
  owner: string,
  webhook: ReleaseHealthWebhook
) {
  if (owner !== previewStoreKey()) throw new Error("missing-context")
  return fetchApi<boolean>(
    `${basePath}/${encodeURIComponent(webhook.id)}?expectedVersion=${webhook.version}`,
    { method: "DELETE", headers: contextHeaders(owner) }
  )
}
export function availableAlertWebhooks(
  items: ReleaseHealthWebhook[],
  projectId: string,
  envId: string
) {
  return items.filter(
    (item) =>
      item.purpose === "release-health" &&
      item.isActive &&
      item.scopes.some((scope) => {
        const [project, environments = ""] = scope.split("/")
        return project === projectId && environments.split(",").includes(envId)
      })
  )
}
export function useReleaseHealthWebhooks<T = ReleaseHealthWebhook[]>(
  select?: (data: ReleaseHealthWebhook[]) => T
) {
  const key = previewStoreKey()
  const client = useQueryClient()
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({
        queryKey: ["release-health-webhooks", key],
      })
    }
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [client, key])
  return useQuery({
    queryKey: ["release-health-webhooks", key],
    queryFn: fetchReleaseHealthWebhooks,
    enabled: Boolean(key),
    retry: false,
    select,
  })
}
