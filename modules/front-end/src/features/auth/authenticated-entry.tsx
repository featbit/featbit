import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Navigate, useLocation, useParams } from "react-router-dom"
import {
  getIdentityToken,
  getStoredUserProfile,
  signOut,
  signOutCurrentTab,
} from "@/features/auth/auth-api"
import {
  chooseProjectEnv,
  clearCurrentContext,
  clearTabProjectEnv,
  getIsSsoFirstLogin,
  getStoredOrganization,
  getStoredWorkspace,
  joinCurrentOrganizationIfSsoFirstLogin,
  persistCurrentOrganization,
  persistCurrentWorkspace,
  resolveLang,
  resolveTabProjectEnvRequest,
  saveCurrentProjectEnv,
  saveTabProjectEnv,
} from "@/features/layout/layout-context"
import {
  organizationsQueryOptions,
  projectsQueryOptions,
  workspacesQueryOptions,
} from "@/features/layout/auth-context-query"
import {
  canUseAction,
  type CurrentUserPolicy,
} from "@/features/iam/current-user-permissions"
import { currentUserPoliciesQueryOptions } from "@/features/iam/current-user-policy-query"
import type { Project } from "@/features/layout/layout-types"
import type { Organization, Workspace } from "@/features/layout/layout-types"
import { fetchApi } from "@/lib/api/authenticated-api"

type EntryStatus =
  | "loading"
  | "ready"
  | "login"
  | "permission-denied"
  | "create-example-project"
  | "select-workspace"
  | "onboarding"

function EntryLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading...
    </main>
  )
}

async function hasAccessibleContextOutsideSelectedOrganization(
  workspaces: Workspace[],
  selectedOrganizationId: string
) {
  try {
    for (const workspace of workspaces) {
      const organizations = await fetchApi<Organization[]>(
        `/api/v1/organizations?isSsoFirstLogin=false`,
        {
          headers: {
            Organization: "",
            Workspace: workspace.id,
          },
        }
      )

      for (const organization of organizations) {
        if (organization.id === selectedOrganizationId) {
          continue
        }

        const headers = {
          Organization: organization.id,
          Workspace: workspace.id,
        }
        const [projects, policies] = await Promise.all([
          fetchApi<Project[]>("/api/v1/projects", { headers }),
          fetchApi<CurrentUserPolicy[]>("/api/v1/user/policies", { headers }),
        ])

        if (
          projects.some((project) => project.environments.length > 0) ||
          canUseAction(policies, "project/*", "CreateProject")
        ) {
          return true
        }
      }
    }

    return false
  } catch {
    return null
  }
}

export function AuthenticatedEntry({ children }: { children: ReactNode }) {
  const params = useParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const lang = resolveLang(params.lang)
  const [entryUrl] = useState(() => `${location.pathname}${location.search}`)
  const [status, setStatus] = useState<EntryStatus>("loading")
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [workspaceCount, setWorkspaceCount] = useState(0)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [organizationId, setOrganizationId] = useState("")
  const [selectStep, setSelectStep] = useState<"workspace" | "organization">(
    "workspace"
  )

  useEffect(() => {
    let cancelled = false

    async function enterApplication() {
      try {
        const userId = getStoredUserProfile().id ?? ""
        const workspaces = await queryClient.ensureQueryData(
          workspacesQueryOptions(userId)
        )
        if (cancelled) {
          return
        }

        if (workspaces.length === 0) {
          signOut()
          setStatus("login")
          return
        }

        setWorkspaceCount(workspaces.length)
        setWorkspaces(workspaces)

        const storedWorkspace = getStoredWorkspace()
        const selectedWorkspace =
          workspaces.length === 1
            ? workspaces[0]
            : workspaces.find(
                (workspace) => workspace.id === storedWorkspace?.id
              )

        if (!selectedWorkspace) {
          localStorage.setItem("login-redirect-url", entryUrl)
          setSelectStep("workspace")
          setStatus("select-workspace")
          return
        }

        persistCurrentWorkspace(selectedWorkspace)

        const isSsoFirstLogin = getIsSsoFirstLogin()
        const organizations = await queryClient.ensureQueryData(
          organizationsQueryOptions(
            userId,
            selectedWorkspace.id,
            isSsoFirstLogin
          )
        )
        if (cancelled) {
          return
        }

        if (organizations.length === 0) {
          localStorage.setItem("login-redirect-url", entryUrl)
          setSelectStep("organization")
          setStatus("select-workspace")
          return
        }

        const storedOrganization = getStoredOrganization()
        const selectedOrganization =
          organizations.length === 1
            ? organizations[0]
            : organizations.find(
                (organization) => organization.id === storedOrganization?.id
              )

        if (!selectedOrganization) {
          localStorage.setItem("login-redirect-url", entryUrl)
          setSelectStep("organization")
          setStatus("select-workspace")
          return
        }

        persistCurrentOrganization(selectedOrganization)
        setOrganizationId(selectedOrganization.id)
        await joinCurrentOrganizationIfSsoFirstLogin()

        if (selectedOrganization.initialized === false) {
          setStatus("onboarding")
          return
        }

        const loadedProjects = await queryClient.ensureQueryData(
          projectsQueryOptions(userId, selectedOrganization.id)
        )
        if (cancelled) {
          return
        }
        setProjects(loadedProjects)
      } catch {
        if (!cancelled) {
          if (!getIdentityToken()) {
            setStatus("login")
            return
          }

          setSelectStep("workspace")
          setStatus("select-workspace")
        }
      }
    }

    void enterApplication()

    return () => {
      cancelled = true
    }
  }, [entryUrl, queryClient])

  useEffect(() => {
    let cancelled = false

    async function synchronizeRouteContext() {
      await Promise.resolve()
      if (cancelled || !projects) {
        return
      }

      const requestedTabProjectEnv = resolveTabProjectEnvRequest(
        projects,
        location.search
      )
      if (requestedTabProjectEnv === null) {
        clearTabProjectEnv()
        signOutCurrentTab()
        setStatus("permission-denied")
        return
      }

      if (requestedTabProjectEnv !== undefined) {
        clearTabProjectEnv()
        saveTabProjectEnv(requestedTabProjectEnv)
      }

      const selectedProjectEnv = chooseProjectEnv(projects)
      if (!selectedProjectEnv) {
        if (organizationId) {
          const policies = await queryClient
            .fetchQuery(currentUserPoliciesQueryOptions(organizationId))
            .catch(() => [])
          if (cancelled) {
            return
          }

          if (canUseAction(policies, "project/*", "CreateProject")) {
            setStatus("create-example-project")
            return
          }
        }

        if (workspaceCount > 1) {
          const hasOtherAccessibleContext =
            await hasAccessibleContextOutsideSelectedOrganization(
              workspaces,
              organizationId
            )
          if (cancelled) {
            return
          }

          clearCurrentContext()
          if (hasOtherAccessibleContext === false) {
            localStorage.removeItem("login-redirect-url")
            setStatus("permission-denied")
          } else {
            localStorage.setItem("login-redirect-url", entryUrl)
            setSelectStep("workspace")
            setStatus("select-workspace")
          }
          return
        }

        clearCurrentContext()
        localStorage.removeItem("login-redirect-url")
        setStatus("permission-denied")
        return
      }

      saveCurrentProjectEnv(selectedProjectEnv)
      setStatus("ready")
    }

    void synchronizeRouteContext()

    return () => {
      cancelled = true
    }
  }, [
    entryUrl,
    location.search,
    organizationId,
    projects,
    queryClient,
    workspaceCount,
    workspaces,
  ])

  if (status === "loading") {
    return <EntryLoading />
  }

  if (status === "login") {
    return <Navigate to={`/${lang}/login`} replace />
  }

  if (status === "permission-denied") {
    return <Navigate to={`/${lang}/login?reason=permission-denied`} replace />
  }

  if (status === "create-example-project") {
    return (
      <Navigate
        to={`/${lang}/onboarding?mode=create-example-project`}
        replace
      />
    )
  }

  if (status === "select-workspace") {
    return (
      <Navigate
        to={`/${lang}/select-workspace${
          selectStep === "organization" ? "?step=organization" : ""
        }`}
        replace
      />
    )
  }

  if (status === "onboarding") {
    return <Navigate to={`/${lang}/onboarding`} replace />
  }

  return children
}
