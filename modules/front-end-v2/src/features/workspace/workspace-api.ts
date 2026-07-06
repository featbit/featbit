import { persistCurrentWorkspace } from "@/features/layout/layout-context"
import type { Workspace } from "@/features/layout/layout-types"
import { fetchApi } from "@/lib/api/authenticated-api"

export type WorkspaceOidcSettings = {
  clientId: string
  clientSecret: string
  tokenEndpoint: string
  clientAuthenticationMethod: string
  authorizationEndpoint: string
  scope: string
  userEmailClaim: string
}

export type WorkspaceDetails = Workspace & {
  sso?: {
    oidc?: Partial<WorkspaceOidcSettings>
  } | null
}

async function workspaceRequest<T>(path: string, init?: RequestInit) {
  return fetchApi<T>(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}

export async function fetchWorkspaceDetails() {
  return workspaceRequest<WorkspaceDetails>("/api/v1/workspaces")
}

export async function updateWorkspaceIdentity(
  payload: Pick<Workspace, "id" | "name" | "key">
) {
  const workspace = await workspaceRequest<WorkspaceDetails>(
    "/api/v1/workspaces",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  )
  persistCurrentWorkspace(workspace)
  return workspace
}

export async function updateWorkspaceOidcSettings(
  payload: WorkspaceOidcSettings & { id: string }
) {
  const workspace = await workspaceRequest<WorkspaceDetails>(
    "/api/v1/workspaces/sso-oidc",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  )
  persistCurrentWorkspace(workspace)
  return workspace
}

export async function isWorkspaceKeyUsed(key: string) {
  return workspaceRequest<boolean>(
    `/api/v1/workspaces/is-key-used?key=${encodeURIComponent(key)}`
  )
}
