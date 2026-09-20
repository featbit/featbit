import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import {
  getCurrentOrganization,
  getCurrentWorkspace,
} from "@/features/layout/layout-context"
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
      !url.password
    )
  } catch {
    return false
  }
}

const storedHookSchema = z.object({
  id: z.string().min(1),
  purpose: z.literal("release-health"),
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().refine(isPreviewEndpoint),
  isActive: z.boolean(),
  scopes: z.array(z.string().min(1)).min(1),
  scopeNames: z.array(z.string()),
  payloadTemplateType: z.enum(["default", "custom"]),
  payloadTemplate: z.string().min(1),
})
const hookSchema = storedHookSchema.extend({
  headers: webhookHeadersSchema.default([]),
  secret: z.string().default(""),
})
export type ReleaseHealthWebhook = z.infer<typeof hookSchema>
export type ReleaseHealthWebhookDraft = Omit<
  ReleaseHealthWebhook,
  "id" | "purpose" | "headers" | "secret"
> &
  Partial<WebhookAuthentication>
const catalogueSchema = z.array(storedHookSchema)
// Credentials are editable in the preview, but never persisted to browser storage.
const authentication = new Map<string, Map<string, WebhookAuthentication>>()
const changed = "featbit:release-health-webhooks-preview-changed"

export function previewStoreKey() {
  const userId = getStoredUserProfile().id
  const workspaceId = getCurrentWorkspace()?.id
  const organizationId = getCurrentOrganization()?.id
  if (!userId || !workspaceId || !organizationId) return null
  return [
    "featbit:release-health-webhooks-preview:v1",
    userId,
    workspaceId,
    organizationId,
  ]
    .map(encodeURIComponent)
    .join(":")
}

export function readPreviewWebhooks(key: string): ReleaseHealthWebhook[] {
  const value = localStorage.getItem(key)
  return value
    ? catalogueSchema.parse(JSON.parse(value)).map((item) => ({
        ...item,
        payloadTemplate:
          item.payloadTemplateType === "default"
            ? ALERT_PAYLOAD_TEMPLATE
            : item.payloadTemplate,
        headers: (authentication.get(key)?.get(item.id)?.headers ?? []).map(
          (header) => ({ ...header })
        ),
        secret: authentication.get(key)?.get(item.id)?.secret ?? "",
      }))
    : []
}

function writePreviewWebhooks(key: string, items: ReleaseHealthWebhook[]) {
  // An allowlist schema prevents credentials or delivery data from entering this preview store.
  const safe = catalogueSchema.parse(items)
  localStorage.setItem(key, JSON.stringify(safe))
  authentication.set(
    key,
    new Map(
      items.map((item) => [
        item.id,
        {
          headers: item.headers.map((header) => ({ ...header })),
          secret: item.secret,
        },
      ])
    )
  )
  window.dispatchEvent(new CustomEvent(changed, { detail: key }))
}

export function savePreviewWebhook(
  key: string,
  draft: ReleaseHealthWebhookDraft,
  id?: string
) {
  const items = readPreviewWebhooks(key)
  if (id && !items.some((item) => item.id === id)) throw new Error("missing")
  if (
    items.some(
      (item) =>
        item.id !== id &&
        item.name.toLowerCase() === draft.name.trim().toLowerCase()
    )
  ) {
    throw new Error("duplicate")
  }
  const item = hookSchema.parse({
    ...draft,
    payloadTemplate:
      draft.payloadTemplateType === "default"
        ? ALERT_PAYLOAD_TEMPLATE
        : draft.payloadTemplate,
    id: id ?? crypto.randomUUID(),
    purpose: "release-health",
  })
  if (validateAlertTemplate(item.payloadTemplate)) throw new Error("template")
  item.headers = item.headers.filter((header) => header.key)
  writePreviewWebhooks(
    key,
    id
      ? items.map((current) => (current.id === id ? item : current))
      : [...items, item]
  )
  return item
}

export function removePreviewWebhook(key: string, id: string) {
  writePreviewWebhooks(
    key,
    readPreviewWebhooks(key).filter((item) => item.id !== id)
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
    const refresh = (event: Event) => {
      if (
        event instanceof StorageEvent &&
        event.key !== key &&
        event.key !== null
      )
        return
      if (event instanceof CustomEvent && event.detail !== key) return
      void client.invalidateQueries({
        queryKey: ["release-health-webhooks-preview", key],
      })
    }
    window.addEventListener("storage", refresh)
    window.addEventListener(changed, refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener(changed, refresh)
    }
  }, [client, key])
  return useQuery({
    queryKey: ["release-health-webhooks-preview", key],
    queryFn: () => {
      if (!key) throw new Error("missing-context")
      return readPreviewWebhooks(key)
    },
    retry: false,
    select,
  })
}
