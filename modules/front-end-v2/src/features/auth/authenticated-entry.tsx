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
import type { Project } from "@/features/layout/layout-types"

type EntryStatus =
  | "loading"
  | "ready"
  | "login"
  | "permission-denied"
  | "select-workspace"
  | "onboarding"

function EntryLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading...
    </main>
  )
}

export function AuthenticatedEntry({ children }: { children: ReactNode }) {
  const params = useParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const lang = resolveLang(params.lang)
  const [entryUrl] = useState(() => `${location.pathname}${location.search}`)
  const [status, setStatus] = useState<EntryStatus>("loading")
  const [projects, setProjects] = useState<Project[] | null>(null)
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
        signOut()
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
  }, [location.search, projects])

  if (status === "loading") {
    return <EntryLoading />
  }

  if (status === "login") {
    return <Navigate to={`/${lang}/login`} replace />
  }

  if (status === "permission-denied") {
    return <Navigate to={`/${lang}/login?reason=permission-denied`} replace />
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
