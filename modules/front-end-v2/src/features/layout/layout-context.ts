import {
  getStoredUserProfile,
  type StoredUserProfile,
} from "@/features/auth/auth-api"
import type {
  Environment,
  Lang,
  Organization,
  Project,
  ProjectEnv,
  Workspace,
} from "@/features/layout/layout-types"
import { fetchAuthenticatedApi } from "@/lib/api/authenticated-api"

const IS_SSO_FIRST_LOGIN_STORAGE_KEY = "is-sso-first-login"

const fallbackOrganization: Organization = {
  id: "acme-org",
  name: "Acme Corp",
  key: "acme",
}

const fallbackWorkspace: Workspace = {
  id: "acme-workspace",
  name: "Acme Workspace",
  key: "acme",
}

export const fallbackProjects: Project[] = [
  {
    id: "growth",
    name: "Growth Platform",
    key: "growth",
    environments: [
      { id: "prod", name: "Production", key: "prod", type: "prod" },
      { id: "staging", name: "Staging", key: "staging", type: "staging" },
      { id: "dev", name: "Development", key: "dev", type: "dev" },
    ],
  },
]

function scopedStorageKey(key: string, profile: StoredUserProfile) {
  return profile.id ? `${key}_${profile.id}` : key
}

function readStorageObject<T>(key: string): T | null {
  const rawValue = localStorage.getItem(key)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return null
  }
}

function contextKey(key: string) {
  return scopedStorageKey(key, getStoredUserProfile())
}

export function resolveLang(value: string | undefined): Lang {
  return value === "zh" ? "zh" : "en"
}

export function localizedPath(lang: Lang, href: string) {
  return `/${lang}${href}`
}

export function projectEnvFromSelection(
  project: Project,
  environment: Environment
): ProjectEnv {
  return {
    projectId: project.id,
    projectName: project.name,
    projectKey: project.key,
    envId: environment.id,
    envName: environment.name,
    envKey: environment.key ?? "",
    envType: environment.type ?? inferEnvironmentType(environment),
  }
}

export function getCurrentWorkspace() {
  return (
    readStorageObject<Workspace>(contextKey("current-workspace")) ??
    fallbackWorkspace
  )
}

export function getCurrentOrganization() {
  return (
    readStorageObject<Organization>(contextKey("current-organization")) ??
    fallbackOrganization
  )
}

export function getCurrentProjectEnv() {
  return (
    readStorageObject<ProjectEnv>(contextKey("current-project")) ??
    projectEnvFromSelection(
      fallbackProjects[0],
      fallbackProjects[0].environments[0]
    )
  )
}

export function getStoredWorkspace() {
  return readStorageObject<Workspace>(contextKey("current-workspace"))
}

export function getStoredOrganization() {
  return readStorageObject<Organization>(contextKey("current-organization"))
}

export function getStoredProjectEnv() {
  return readStorageObject<ProjectEnv>(contextKey("current-project"))
}

export function saveCurrentProjectEnv(projectEnv: ProjectEnv) {
  localStorage.setItem(contextKey("current-project"), JSON.stringify(projectEnv))
}

function saveCurrentWorkspace(workspace: Workspace) {
  localStorage.setItem(contextKey("current-workspace"), JSON.stringify(workspace))
}

function saveCurrentOrganization(organization: Organization) {
  localStorage.setItem(
    contextKey("current-organization"),
    JSON.stringify(organization)
  )
}

export function inferEnvironmentType(
  environment: Pick<Environment, "name" | "key">
): "prod" | "staging" | "dev" {
  const value = `${environment.name} ${environment.key ?? ""}`.toLowerCase()
  if (value.includes("prod") || value.includes("生产")) {
    return "prod"
  }

  if (value.includes("stag") || value.includes("qa") || value.includes("预发")) {
    return "staging"
  }

  return "dev"
}

export function normalizeProjects(projects: Project[]) {
  return projects.map((project) => ({
    ...project,
    environments: project.environments.map((environment) => ({
      ...environment,
      type: environment.type ?? inferEnvironmentType(environment),
    })),
  }))
}

export function chooseWorkspace(workspaces: Workspace[]) {
  const currentWorkspace = getCurrentWorkspace()
  return (
    workspaces.find((workspace) => workspace.id === currentWorkspace.id) ??
    workspaces[0] ??
    currentWorkspace
  )
}

export function chooseOrganization(organizations: Organization[]) {
  const currentOrganization = getCurrentOrganization()
  return (
    organizations.find(
      (organization) => organization.id === currentOrganization.id
    ) ??
    organizations[0] ??
    currentOrganization
  )
}

export function chooseProjectEnv(projects: Project[]) {
  const currentProjectEnv = getCurrentProjectEnv()
  const currentProject = projects.find(
    (project) => project.id === currentProjectEnv.projectId
  )
  const currentEnvironment = currentProject?.environments.find(
    (environment) => environment.id === currentProjectEnv.envId
  )

  if (currentProject && currentEnvironment) {
    return projectEnvFromSelection(currentProject, currentEnvironment)
  }

  const firstProject = projects[0]
  const firstEnvironment = firstProject?.environments[0]
  if (firstProject && firstEnvironment) {
    return projectEnvFromSelection(firstProject, firstEnvironment)
  }

  return currentProjectEnv
}

export function persistCurrentWorkspace(workspace: Workspace) {
  saveCurrentWorkspace(workspace)
}

export function persistCurrentOrganization(organization: Organization) {
  saveCurrentOrganization(organization)
}

export async function fetchWorkspaces() {
  return fetchAuthenticatedApi<Workspace[]>("/api/v1/user/workspaces")
}

export async function fetchOrganizations() {
  const isSsoFirstLogin =
    localStorage.getItem(IS_SSO_FIRST_LOGIN_STORAGE_KEY) === "true"
  return fetchAuthenticatedApi<Organization[]>(
    `/api/v1/organizations?isSsoFirstLogin=${isSsoFirstLogin}`
  )
}

export async function fetchProjects() {
  const projects = await fetchAuthenticatedApi<Project[]>("/api/v1/projects")
  return normalizeProjects(
    projects.sort((a, b) => a.name.localeCompare(b.name))
  )
}

export async function joinCurrentOrganizationIfSsoFirstLogin() {
  if (localStorage.getItem(IS_SSO_FIRST_LOGIN_STORAGE_KEY) !== "true") {
    return
  }

  await fetchAuthenticatedApi<boolean>("/api/v1/user/join-organization", {
    method: "POST",
  })
  localStorage.removeItem(IS_SSO_FIRST_LOGIN_STORAGE_KEY)
}
