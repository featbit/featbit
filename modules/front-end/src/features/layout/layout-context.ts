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
const PROJECTS_CHANGED_EVENT = "featbit:projects-changed"
const TAB_PROJECT_ENV_STORAGE_KEY = "current-project-tab"
const TAB_CONTEXT_PARAM = "context"
const TAB_CONTEXT_VALUE = "environment"
const TAB_PROJECT_ID_PARAM = "projectId"
const TAB_ENV_ID_PARAM = "envId"

function scopedStorageKey(key: string, profile: StoredUserProfile) {
  return profile.id ? `${key}_${profile.id}` : key
}

function readStorageObject<T>(storage: Storage, key: string): T | null {
  const rawValue = storage.getItem(key)
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

export function localizedProjectEnvPath(
  lang: Lang,
  href: string,
  projectEnv: Pick<ProjectEnv, "projectId" | "envId">
) {
  const searchParams = new URLSearchParams({
    [TAB_CONTEXT_PARAM]: TAB_CONTEXT_VALUE,
    [TAB_PROJECT_ID_PARAM]: projectEnv.projectId,
    [TAB_ENV_ID_PARAM]: projectEnv.envId,
  })
  const separator = href.includes("?") ? "&" : "?"

  return `${localizedPath(lang, href)}${separator}${searchParams.toString()}`
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
  return getStoredTabProjectEnv() ?? getStoredProjectEnv()
}

export function getStoredWorkspace() {
  return readStorageObject<Workspace>(
    localStorage,
    contextKey("current-workspace")
  )
}

export function getStoredOrganization() {
  return readStorageObject<Organization>(
    localStorage,
    contextKey("current-organization")
  )
}

export function getStoredProjectEnv() {
  return readStorageObject<ProjectEnv>(
    localStorage,
    contextKey("current-project")
  )
}

export function getStoredTabProjectEnv() {
  return readStorageObject<ProjectEnv>(
    sessionStorage,
    contextKey(TAB_PROJECT_ENV_STORAGE_KEY)
  )
}

export function hasTabProjectEnvOverride() {
  return (
    sessionStorage.getItem(contextKey(TAB_PROJECT_ENV_STORAGE_KEY)) !== null
  )
}

export function resolveTabProjectEnvRequest(
  projects: Project[],
  search: string
): ProjectEnv | null | undefined {
  const searchParams = new URLSearchParams(search)
  if (searchParams.get(TAB_CONTEXT_PARAM) !== TAB_CONTEXT_VALUE) {
    return undefined
  }

  const projectId = searchParams.get(TAB_PROJECT_ID_PARAM)
  const envId = searchParams.get(TAB_ENV_ID_PARAM)
  if (!projectId || !envId) {
    return null
  }

  const project = projects.find((item) => item.id === projectId)
  const environment = project?.environments.find((item) => item.id === envId)

  return project && environment
    ? projectEnvFromSelection(project, environment)
    : null
}

export function saveTabProjectEnv(projectEnv: ProjectEnv) {
  sessionStorage.setItem(
    contextKey(TAB_PROJECT_ENV_STORAGE_KEY),
    JSON.stringify(projectEnv)
  )
}

export function clearTabProjectEnv() {
  sessionStorage.removeItem(contextKey(TAB_PROJECT_ENV_STORAGE_KEY))
}

export function saveCurrentProjectEnv(projectEnv: ProjectEnv) {
  if (hasTabProjectEnvOverride()) {
    saveTabProjectEnv(projectEnv)
    return
  }

  localStorage.setItem(
    contextKey("current-project"),
    JSON.stringify(projectEnv)
  )
}

export function clearCurrentProjectEnv() {
  localStorage.removeItem(contextKey("current-project"))
  clearTabProjectEnv()
}

export function clearCurrentContext() {
  localStorage.removeItem(contextKey("current-workspace"))
  localStorage.removeItem(contextKey("current-organization"))
  clearCurrentProjectEnv()
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

  return null
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

export function notifyProjectsChanged() {
  window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT))
}

export function onProjectsChanged(callback: () => void) {
  window.addEventListener(PROJECTS_CHANGED_EVENT, callback)

  return () => {
    window.removeEventListener(PROJECTS_CHANGED_EVENT, callback)
  }
}

export async function fetchWorkspaces() {
  return fetchApi<Workspace[]>("/api/v1/user/workspaces")
}

export async function fetchOrganizations() {
  const isSsoFirstLogin = getIsSsoFirstLogin()
  return fetchApi<Organization[]>(
    `/api/v1/organizations?isSsoFirstLogin=${isSsoFirstLogin}`
  )
}

export function getIsSsoFirstLogin() {
  return localStorage.getItem(IS_SSO_FIRST_LOGIN_STORAGE_KEY) === "true"
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
