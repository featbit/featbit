import {
  fetchApi,
  persistCurrentWorkspace,
  type Workspace
} from "@/features/layout/context";

export type WorkspaceOidcSettings = {
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  clientAuthenticationMethod: string;
  authorizationEndpoint: string;
  scope: string;
  userEmailClaim: string;
};

export type WorkspaceDetails = Workspace & {
  sso?: {
    oidc?: Partial<WorkspaceOidcSettings>;
  } | null;
};

async function workspaceRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return fetchApi<T>(path, undefined, true, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
}

export async function updateWorkspaceIdentity(payload: Pick<Workspace, "id" | "name" | "key">) {
  const workspace = await workspaceRequest<WorkspaceDetails>("/api/v1/workspaces", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  persistCurrentWorkspace(workspace);
  return workspace;
}

export async function fetchWorkspaceDetails() {
  return workspaceRequest<WorkspaceDetails>("/api/v1/workspaces");
}

export async function updateWorkspaceOidcSettings(payload: WorkspaceOidcSettings & { id: string }) {
  const workspace = await workspaceRequest<WorkspaceDetails>("/api/v1/workspaces/sso-oidc", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  persistCurrentWorkspace(workspace);
  return workspace;
}

export async function updateWorkspaceLicense(license: string) {
  const workspace = await workspaceRequest<WorkspaceDetails>("/api/v1/workspaces/license", {
    method: "PUT",
    body: JSON.stringify({ license })
  });
  persistCurrentWorkspace(workspace);
  return workspace;
}

export async function isWorkspaceKeyUsed(key: string) {
  return workspaceRequest<boolean>(`/api/v1/workspaces/is-key-used?key=${encodeURIComponent(key)}`);
}
