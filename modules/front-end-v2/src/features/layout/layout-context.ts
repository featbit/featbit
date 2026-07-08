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
import { fetchApi } from "@/lib/api/authenticated-api"

const IS_SSO_FIRST_LOGIN_STORAGE_KEY = "is-sso-first-login"
const ORGANIZATION_CHANGED_EVENT = "featbit:organization-changed"

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
  }
}

export function getCurrentWorkspace() {
  return getStoredWorkspace()
}

export function getCurrentOrganization() {
  return getStoredOrganization()
}

export function getCurrentProjectEnv() {
  return getStoredProjectEnv()
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
  localStorage.setItem(
    contextKey("current-project"),
    JSON.stringify(projectEnv)
  )
}

export function clearCurrentProjectEnv() {
  localStorage.removeItem(contextKey("current-project"))
}

function saveCurrentWorkspace(workspace: Workspace) {
  localStorage.setItem(
    contextKey("current-workspace"),
    JSON.stringify(workspace)
  )
}

function saveCurrentOrganization(organization: Organization) {
  localStorage.setItem(
    contextKey("current-organization"),
    JSON.stringify(organization)
  )
}

export function chooseProjectEnv(projects: Project[]) {
  const currentProjectEnv = getCurrentProjectEnv()
  const currentProject = projects.find(
    (project) =>
      project.id === currentProjectEnv?.projectId ||
      project.key === currentProjectEnv?.projectKey
  )
  const currentEnvironment = currentProject?.environments.find(
    (environment) =>
      environment.id === currentProjectEnv?.envId ||
      environment.key === currentProjectEnv?.envKey
  )

  if (currentProject && currentEnvironment) {
    return projectEnvFromSelection(currentProject, currentEnvironment)
  }

  const firstProject = projects[0]
  const firstEnvironment = firstProject?.environments[0]
  if (firstProject && firstEnvironment) {
    return projectEnvFromSelection(firstProject, firstEnvironment)
  }

  return currentProjectEnv ?? null
}

export function persistCurrentWorkspace(workspace: Workspace) {
  saveCurrentWorkspace(workspace)
}

export function persistCurrentOrganization(organization: Organization) {
  saveCurrentOrganization(organization)

  window.dispatchEvent(new Event(ORGANIZATION_CHANGED_EVENT))
}

export function onCurrentOrganizationChanged(callback: () => void) {
  window.addEventListener(ORGANIZATION_CHANGED_EVENT, callback)

  return () => {
    window.removeEventListener(ORGANIZATION_CHANGED_EVENT, callback)
  }
}

export async function fetchWorkspaces() {
  return fetchApi<Workspace[]>("/api/v1/user/workspaces")
}

export async function fetchOrganizations() {
  const isSsoFirstLogin =
    localStorage.getItem(IS_SSO_FIRST_LOGIN_STORAGE_KEY) === "true"
  return fetchApi<Organization[]>(
    `/api/v1/organizations?isSsoFirstLogin=${isSsoFirstLogin}`
  )
}

export async function fetchProjects() {
  return fetchApi<Project[]>("/api/v1/projects")
}

export async function joinCurrentOrganizationIfSsoFirstLogin() {
  if (localStorage.getItem(IS_SSO_FIRST_LOGIN_STORAGE_KEY) !== "true") {
    return
  }

  await fetchApi<boolean>("/api/v1/user/join-organization", {
    method: "POST",
  })
  localStorage.removeItem(IS_SSO_FIRST_LOGIN_STORAGE_KEY)
}
