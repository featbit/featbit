import { getIdentityToken } from "@/features/auth/auth-api";
import {
  getCurrentOrganization,
  getCurrentWorkspace,
  persistCurrentWorkspace,
  type Workspace
} from "@/features/layout/context";
import { getRuntimeEnv } from "@/lib/env/runtime-env";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  errors?: string[];
};

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

function apiOrigin() {
  return getRuntimeEnv().apiUrl || "http://localhost:5000";
}

function unwrapApiResponse<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    const envelope = body as ApiEnvelope<T>;
    if (envelope.success === false) {
      throw new Error(envelope.errors?.[0] || "Request failed");
    }

    return envelope.data as T;
  }

  return body as T;
}

async function workspaceRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const workspace = getCurrentWorkspace();
  const organization = getCurrentOrganization();
  const response = await fetch(`${apiOrigin()}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Authorization: `Bearer ${getIdentityToken() ?? ""}`,
      "Content-Type": "application/json",
      Organization: organization.id ?? "",
      Workspace: workspace.id ?? "",
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw new Error(response.statusText || "Request failed");
  }

  const body = (await response.json()) as T | ApiEnvelope<T>;
  return unwrapApiResponse<T>(body);
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
