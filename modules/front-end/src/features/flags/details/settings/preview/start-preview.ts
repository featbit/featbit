import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import {
  currentPreviewFlag,
  initializePreviewFixtures,
  previewEnvironments,
  previewFlagKey,
  previewProjectId,
  previewUser,
} from "./preview-fixtures"
import { readCustomFieldsProject } from "../../../custom-fields/custom-fields-storage"
import {
  previewComparison,
  previewCompareOverview,
  copyPreviewRuntimeSettings,
} from "./preview-comparison"

// Opt-in browser fixtures for the existing application routes. No backend runs,
// and every API request is handled here instead of reaching a live service.
export function startFlagSettingsPreview() {
  initializePreviewFixtures()
  const roles = ["project-admin", "flag-editor", "read-only"]
  const requestedRole = new URLSearchParams(window.location.search).get(
    "preview-role"
  )
  const storedRole = sessionStorage.getItem(
    "featbit:flag-settings-preview-role"
  )
  const activeRole = roles.includes(requestedRole ?? "")
    ? requestedRole!
    : roles.includes(storedRole ?? "")
      ? storedRole!
      : "project-admin"
  sessionStorage.setItem("featbit:flag-settings-preview-role", activeRole)
  localStorage.setItem("token", "flag-settings-design-preview")
  localStorage.setItem("auth", JSON.stringify(previewUser))
  localStorage.setItem(
    "featbit:auth-session-id",
    "flag-settings-design-preview"
  )
  sessionStorage.removeItem("featbit:tab-signed-out")
  const license = `preview.${btoa(JSON.stringify({ plan: "Enterprise", exp: 4102444800000, features: ["*"], sub: "preview", wsId: "preview-workspace", iat: Date.now(), issuer: "local-preview" }))}.preview`
  const workspace = {
    id: "preview-workspace",
    key: "featbit",
    name: "FeatBit",
    license,
  }
  const organization = {
    id: "preview-organization",
    key: "featbit",
    name: "FeatBit",
    initialized: true,
  }
  const project = {
    id: previewProjectId,
    name: "FeatBit Demo",
    key: "featbit-demo",
    environments: previewEnvironments.map((environment) => ({
      ...environment,
      projectId: previewProjectId,
      settings: { requireChangeComment: false },
      secrets: [],
    })),
  }
  localStorage.setItem(
    `current-workspace_${previewUser.id}`,
    JSON.stringify(workspace)
  )
  localStorage.setItem(
    `current-organization_${previewUser.id}`,
    JSON.stringify(organization)
  )
  const selectedEnvironment =
    previewEnvironments.find(
      (environment) => environment.id === getCurrentProjectEnv()?.envId
    ) ?? previewEnvironments[0]
  localStorage.setItem(
    `current-project_${previewUser.id}`,
    JSON.stringify({
      projectId: previewProjectId,
      projectName: project.name,
      projectKey: project.key,
      envId: selectedEnvironment.id,
      envName: selectedEnvironment.name,
      envKey: selectedEnvironment.key,
    })
  )
  const realFetch = window.fetch.bind(window)
  const ok = (data: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  window.fetch = (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      window.location.origin
    )
    const path = url.pathname
    if (!path.startsWith("/api/")) return realFetch(input, init)
    const requestEnvId =
      path.match(/\/envs\/([^/]+)/)?.[1] ??
      url.searchParams.get("scopeId") ??
      url.searchParams.get("envId") ??
      selectedEnvironment.id
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET")
    if (path.endsWith("/feature-flags/compare-overview") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"))
      return ok(
        previewCompareOverview(
          requestEnvId,
          body.targetEnvIds ?? [],
          body.filter ?? {}
        )
      )
    }
    const compareTarget = path.match(/\/compare-with\/([^/]+)$/)?.[1]
    if (compareTarget && method === "GET")
      return ok(previewComparison(requestEnvId, compareTarget))
    const copyTarget = path.match(/\/copy-settings-to\/([^/]+)$/)?.[1]
    if (copyTarget && method === "PUT") {
      copyPreviewRuntimeSettings(
        requestEnvId,
        copyTarget,
        JSON.parse(String(init?.body ?? "{}")).options
      )
      return ok(true)
    }
    if (path === "/api/v1/user/workspaces") return ok([workspace])
    if (path.startsWith("/api/v1/organizations")) return ok([organization])
    if (path === "/api/v1/projects") return ok([project])
    if (path === "/api/v1/user/profile") return ok(previewUser)
    if (path === "/api/v1/user/policies")
      return ok([
        {
          name: "Preview administrator",
          type: "SysManaged",
          statements: [
            {
              resourceType: "*",
              effect: "allow",
              actions: ["*"],
              resources: ["*"],
            },
            ...(["flag-editor", "read-only"].includes(activeRole)
              ? [
                  {
                    resourceType: "Project",
                    effect: "deny",
                    actions: ["UpdateProjectSettings"],
                    resources: ["project/featbit-demo"],
                  },
                ]
              : []),
            ...(activeRole === "read-only"
              ? [
                  {
                    resourceType: "Flag",
                    effect: "deny",
                    actions: ["UpdateFlagDescription"],
                    resources: ["project/featbit-demo:env/*:flag/*"],
                  },
                ]
              : []),
          ],
        },
      ])
    if (path.endsWith("/all-tags"))
      return ok(currentPreviewFlag(requestEnvId).tags)
    if (
      path.endsWith("/running-experiments") ||
      path.endsWith("/pending-changes") ||
      path.endsWith("/properties")
    )
      return ok([])
    if (path.endsWith(`/feature-flags/${previewFlagKey}`) && method === "GET")
      return ok(currentPreviewFlag(requestEnvId))
    if (
      path.endsWith(`/feature-flags/${previewFlagKey}/general`) &&
      method === "PUT"
    )
      return ok(`preview-${Date.now()}`)
    if (path.endsWith("/feature-flags") && method === "GET") {
      const flag = currentPreviewFlag(requestEnvId)
      const search = url.searchParams.get("name")?.toLowerCase() ?? ""
      const items = `${flag.name} ${flag.key}`.toLowerCase().includes(search)
        ? [flag]
        : []
      return ok({ items, totalCount: items.length })
    }
    if (path === "/api/v1/audit-logs") {
      const history = readCustomFieldsProject(previewProjectId).history.filter(
        (entry) =>
          entry.envId === requestEnvId && entry.flagKey === previewFlagKey
      )
      const items = history.map((entry) => ({
        id: entry.id,
        refId: "rainy-day-rescue-id",
        refType: "FeatureFlag",
        operation: "Update",
        creatorId: previewUser.id,
        creatorName: previewUser.name,
        creatorEmail: previewUser.email,
        createdAt: entry.at,
        comment: entry.comment,
        dataChange: {
          previous: JSON.stringify({
            ...currentPreviewFlag(requestEnvId),
            ...entry.previous.general,
            customFields: entry.previous.customFields,
          }),
          current: JSON.stringify({
            ...currentPreviewFlag(requestEnvId),
            ...entry.current.general,
            customFields: entry.current.customFields,
          }),
        },
        instructions: [],
      }))
      return ok({ items, totalCount: items.length })
    }
    if (path.includes("/end-users") || path.includes("/members"))
      return ok({ items: [], totalCount: 0 })
    if (method === "GET") return ok([])
    return Promise.resolve(
      new Response(
        JSON.stringify({
          success: false,
          errors: ["This action is outside the flag Settings preview."],
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    )
  }
}
