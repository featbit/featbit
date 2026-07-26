import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Navigate, useLocation, useParams } from "react-router-dom"
import {
  getIdentityToken,
  signOut,
  signOutCurrentTab,
} from "@/features/auth/auth-api"
import {
  chooseProjectEnv,
  clearTabProjectEnv,
  fetchOrganizations,
  fetchProjects,
  fetchWorkspaces,
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
  const lang = resolveLang(params.lang)
  const [status, setStatus] = useState<EntryStatus>("loading")
  const [selectStep, setSelectStep] = useState<"workspace" | "organization">(
    "workspace"
  )

  useEffect(() => {
    let cancelled = false

    async function enterApplication() {
      try {
        const workspaces = await fetchWorkspaces()
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
          localStorage.setItem(
            "login-redirect-url",
            `${location.pathname}${location.search}`
          )
          setSelectStep("workspace")
          setStatus("select-workspace")
          return
        }

        persistCurrentWorkspace(selectedWorkspace)

        const organizations = await fetchOrganizations()
        if (cancelled) {
          return
        }

        if (organizations.length === 0) {
          localStorage.setItem(
            "login-redirect-url",
            `${location.pathname}${location.search}`
          )
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
          localStorage.setItem(
            "login-redirect-url",
            `${location.pathname}${location.search}`
          )
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

        const projects = await fetchProjects()
        if (cancelled) {
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
  }, [location.pathname, location.search])

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
