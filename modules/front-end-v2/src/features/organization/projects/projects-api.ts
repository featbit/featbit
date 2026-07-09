import { fetchApi } from "@/lib/api/authenticated-api"

export type SecretType = "client" | "server"

export type EnvironmentSecret = {
  id: string
  name: string
  type: SecretType
  value: string
}

export type EnvironmentSettings = {
  requireChangeComment: boolean
}

export type ProjectEnvironment = {
  id: string
  projectId: string
  name: string
  key: string
  description?: string
  secrets: EnvironmentSecret[]
  settings: EnvironmentSettings
}

export type OrganizationProject = {
  id: string
  name: string
  key: string
  environments: ProjectEnvironment[]
}

export type ProjectPayload = {
  name: string
  key?: string
}

export type EnvironmentPayload = {
  name: string
  key?: string
  description?: string
  settings: EnvironmentSettings
}

export type CreateSecretPayload = {
  name: string
  type: SecretType
}

function projectRequest<T>(path: string, init?: RequestInit) {
  return fetchApi<T>(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}

function normalizeSecret(secret: EnvironmentSecret): EnvironmentSecret {
  return {
    ...secret,
    type: secret.type === "server" ? "server" : "client",
  }
}

function normalizeEnvironment(
  environment: ProjectEnvironment,
  projectId: string
): ProjectEnvironment {
  return {
    ...environment,
    projectId: environment.projectId ?? projectId,
    key: environment.key ?? "",
    description: environment.description ?? "",
    secrets: (environment.secrets ?? []).map(normalizeSecret),
    settings: {
      requireChangeComment:
        environment.settings?.requireChangeComment ?? false,
    },
  }
}

export function normalizeProject(project: OrganizationProject) {
  return {
    ...project,
    environments: (project.environments ?? []).map((environment) =>
      normalizeEnvironment(environment, project.id)
    ),
  }
}

export async function fetchOrganizationProjects() {
  const projects = await projectRequest<OrganizationProject[]>("/api/v1/projects")
  return projects.map(normalizeProject).sort((a, b) => a.name.localeCompare(b.name))
}

export function isProjectKeyUsed(key: string) {
  return projectRequest<boolean>(
    `/api/v1/projects/is-key-used?key=${encodeURIComponent(key)}`
  )
}

export function isEnvironmentKeyUsed(projectId: string, key: string) {
  return projectRequest<boolean>(
    `/api/v1/projects/${projectId}/envs/is-key-used?key=${encodeURIComponent(key)}`
  )
}

export async function createProject(payload: Required<ProjectPayload>) {
  return normalizeProject(
    await projectRequest<OrganizationProject>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  )
}

export async function updateProject(projectId: string, payload: { name: string }) {
  return normalizeProject(
    await projectRequest<OrganizationProject>(`/api/v1/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  )
}

export function deleteProject(projectId: string) {
  return projectRequest<boolean>(`/api/v1/projects/${projectId}`, {
    method: "DELETE",
  })
}

export async function createEnvironment(
  projectId: string,
  payload: Required<EnvironmentPayload>
) {
  return normalizeEnvironment(
    await projectRequest<ProjectEnvironment>(`/api/v1/projects/${projectId}/envs`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    projectId
  )
}

export async function updateEnvironment(
  projectId: string,
  environmentId: string,
  payload: Omit<EnvironmentPayload, "key">
) {
  return normalizeEnvironment(
    await projectRequest<ProjectEnvironment>(
      `/api/v1/projects/${projectId}/envs/${environmentId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    ),
    projectId
  )
}

export function deleteEnvironment(projectId: string, environmentId: string) {
  return projectRequest<boolean>(
    `/api/v1/projects/${projectId}/envs/${environmentId}`,
    {
      method: "DELETE",
    }
  )
}

export function createSecret(environmentId: string, payload: CreateSecretPayload) {
  return projectRequest<EnvironmentSecret>(`/api/v1/envs/${environmentId}/secrets`, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then(normalizeSecret)
}

export function updateSecretName(
  environmentId: string,
  secretId: string,
  name: string
) {
  return projectRequest<boolean>(
    `/api/v1/envs/${environmentId}/secrets/${secretId}`,
    {
      method: "PUT",
      body: JSON.stringify({ name }),
    }
  )
}

export function deleteSecret(environmentId: string, secretId: string) {
  return projectRequest<boolean>(
    `/api/v1/envs/${environmentId}/secrets/${secretId}`,
    {
      method: "DELETE",
    }
  )
}
