import Handlebars from "handlebars"
import type { Project } from "@/features/layout/layout-types"
import {
  getCurrentOrganization,
  getCurrentProjectEnv,
} from "@/features/layout/layout-context"
import type {
  DeliveryRequest,
  DeliveryResponse,
  EnvironmentResource,
  WebhookHeader,
} from "./webhook-types"

export function creatorLabel(creator?: { name?: string; email?: string }) {
  return creator?.name || creator?.email || "—"
}

export function formatDateTime(value?: string, locale?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date)
}

export function formatDuration(startedAt: string, endedAt: string) {
  const duration = Math.max(
    0,
    new Date(endedAt).getTime() - new Date(startedAt).getTime()
  )
  if (duration < 1000) return `${duration} ms`
  return `${(duration / 1000).toFixed(duration < 10_000 ? 2 : 1)} s`
}

export function tryFormatJson(value?: string) {
  if (!value) return ""
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function headersToText(
  headers?: DeliveryRequest["headers"] | DeliveryResponse["headers"] | null
) {
  if (!headers) return ""
  const entries: WebhookHeader[] = Array.isArray(headers)
    ? headers
    : Object.entries(headers).map(([key, value]) => ({ key, value }))
  return entries.map(({ key, value }) => `${key}: ${value}`).join("\n")
}

export function scopeEnvironmentIds(scopes: string[]) {
  return scopes.flatMap((scope) => {
    const [, environmentIds = ""] = scope.split("/")
    return environmentIds.split(",").filter(Boolean)
  })
}

export function serializeScopes(environmentIds: string[], projects: Project[]) {
  const selected = new Set(environmentIds)
  return projects.flatMap((project) => {
    const ids = project.environments
      .filter((environment) => selected.has(environment.id))
      .map((environment) => environment.id)
    return ids.length > 0 ? [`${project.id}/${ids.join(",")}`] : []
  })
}

export function resourceProjectName(resource: EnvironmentResource) {
  const parts = resource.pathName.split("/").filter(Boolean)
  return parts.length > 1 ? (parts.at(-2) ?? "Project") : "Project"
}

function testData(event: string) {
  const organization = getCurrentOrganization()
  const projectEnv = getCurrentProjectEnv()
  const base = {
    events: event,
    operator: "webhook-tester",
    happenedAt: new Date().toISOString(),
    changes: ["test change description 1", "test change description 2"],
    organization: {
      id: organization?.id ?? "organization-id",
      name: organization?.name ?? "Test Organization",
    },
    project: {
      id: projectEnv?.projectId ?? "project-id",
      name: projectEnv?.projectName ?? "Test Project",
    },
    environment: {
      id: projectEnv?.envId ?? "environment-id",
      name: projectEnv?.envName ?? "Test Environment",
    },
  }
  if (event.startsWith("segment")) {
    return {
      ...base,
      data: {
        kind: "segment",
        object: {
          id: "510766ab-bf7d-4a80-a601-68beced8360e",
          name: "Test Segment",
          description: "This is a test segment",
          tags: ["test", "demo"],
          included: ["truthy-user"],
          excluded: ["falsy-user"],
          rules: [],
          flagReferences: [],
          isArchived: false,
        },
      },
    }
  }
  return {
    ...base,
    data: {
      kind: "feature flag",
      object: {
        id: "eac7cb6e-9860-4d58-b1fb-82c7bf5d5025",
        name: "Test Feature Flag",
        description: "This is a test feature flag",
        tags: ["test", "demo"],
        key: "test",
        variationType: "boolean",
        variations: [
          { id: "true", name: "TRUE", value: "true" },
          { id: "false", name: "FALSE", value: "false" },
        ],
        targetUsers: [],
        rules: [],
        isEnabled: true,
        disabledVariationId: "false",
        fallthrough: { variations: [{ id: "true", rollout: [0, 1] }] },
        exptIncludeAllTargets: true,
        isArchived: false,
      },
    },
  }
}

export function renderTestPayload(event: string, template: string) {
  const runtime = Handlebars.create()
  runtime.registerHelper(
    "json",
    (value: unknown) => new runtime.SafeString(JSON.stringify(value, null, 2))
  )
  runtime.registerHelper(
    "eq",
    function (this: unknown, left: unknown, right: unknown, options) {
      return left === right ? options.fn(this) : options.inverse(this)
    }
  )
  return runtime.compile(template)(testData(event))
}

export function validateJsonHandlebars(template: string) {
  try {
    const rendered = renderTestPayload("feature_flag.toggled", template)
    JSON.parse(rendered)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid template"
  }
}

export function newId() {
  return crypto.randomUUID()
}
