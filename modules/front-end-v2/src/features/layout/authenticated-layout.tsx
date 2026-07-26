import { useCallback, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom"
import { signOut } from "@/features/auth/auth-api"
import { ContextBar } from "@/features/layout/components/context-bar"
import { GlobalMessageBanner } from "@/features/layout/components/global-message-banner"
import { buildBillingGlobalMessages } from "@/features/layout/global-message"
import {
  chooseProjectEnv,
  clearTabProjectEnv,
  fetchProjects,
  getCurrentOrganization,
  getCurrentProjectEnv,
  getCurrentWorkspace,
  hasTabProjectEnvOverride,
  onCurrentOrganizationChanged,
  onProjectsChanged,
  resolveLang,
  saveCurrentProjectEnv,
} from "@/features/layout/layout-context"
import type {
  Organization,
  Project,
  ProjectEnv,
  Workspace,
} from "@/features/layout/layout-types"
import { Sidebar } from "@/features/layout/components/sidebar"
import { SubscriptionLicenseBadge } from "@/features/layout/components/subscription-license-badge"
import {
  fetchCurrentCycle,
  fetchSubscription,
} from "@/features/workspace/billing/billing-api"
import { getRuntimeEnv } from "@/lib/env/runtime-env"

const SIDEBAR_STORAGE_KEY = "featbit:sidebar-collapsed"
const UI_BROADCAST_CHANNEL = "featbit-ui-broadcast-channel"
const ENV_CHANGED_MESSAGE = "env-changed"
const ORG_CHANGED_MESSAGE = "org-changed"
const HOSTING_MODE_SAAS = "saas"

function getEnvironmentReloadPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  const [lang, featureSegment] = segments

  if (lang && featureSegment) {
    return `/${lang}/${featureSegment}`
  }

  if (lang) {
    return `/${lang}`
  }

  return pathname || "/"
}

export function AuthenticatedLayout() {
  const { lang: langParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const lang = resolveLang(langParam)
  const { i18n } = useTranslation()
  const [collapsed, setCollapsedState] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
  )
  const [workspace, setWorkspace] = useState<Workspace | null>(() =>
    getCurrentWorkspace()
  )
  const [organization, setOrganization] = useState<Organization | null>(() =>
    getCurrentOrganization()
  )
  const [currentProjectEnv, setCurrentProjectEnv] = useState<ProjectEnv | null>(
    () => getCurrentProjectEnv()
  )
  const [projects, setProjects] = useState<Project[]>([])
  const isSaas = getRuntimeEnv().hostingMode === HOSTING_MODE_SAAS
  const subscriptionQuery = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: fetchSubscription,
    enabled: isSaas,
  })
  const cycleQuery = useQuery({
    queryKey: ["billing", "current-cycle"],
    queryFn: fetchCurrentCycle,
    enabled: isSaas,
  })
  const globalMessage = buildBillingGlobalMessages(
    workspace,
    lang,
    subscriptionQuery.data,
    cycleQuery.data
  )[0]
  const denyEnvironmentAccess = useCallback(() => {
    signOut()
    navigate(`/${lang}/login?reason=permission-denied`, { replace: true })
  }, [lang, navigate])

  function setCollapsed(nextCollapsed: boolean) {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextCollapsed))
    setCollapsedState(nextCollapsed)
  }

  function changeCurrentProjectEnv(nextProjectEnv: ProjectEnv) {
    const isSameProjectEnv =
      currentProjectEnv?.projectId === nextProjectEnv.projectId &&
      currentProjectEnv?.envId === nextProjectEnv.envId

    if (isSameProjectEnv) {
      return
    }

    const isTabScoped = hasTabProjectEnvOverride()
    saveCurrentProjectEnv(nextProjectEnv)
    setCurrentProjectEnv(nextProjectEnv)
    if (!isTabScoped && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel(UI_BROADCAST_CHANNEL)
      channel.postMessage(ENV_CHANGED_MESSAGE)
      channel.close()
    }
    window.location.assign(getEnvironmentReloadPath(location.pathname))
  }

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      return
    }

    const channel = new BroadcastChannel(UI_BROADCAST_CHANNEL)
    channel.onmessage = (event) => {
      if (event.data === ENV_CHANGED_MESSAGE && !hasTabProjectEnvOverride()) {
        window.location.assign(getEnvironmentReloadPath(location.pathname))
      }

      if (event.data === ORG_CHANGED_MESSAGE) {
        clearTabProjectEnv()
        window.location.assign(`/${lang}`)
      }
    }

    return () => {
      channel.close()
    }
  }, [lang, location.pathname])

  useEffect(() => {
    return onCurrentOrganizationChanged(() => {
      setOrganization(getCurrentOrganization())
    })
  }, [])

  useEffect(() => {
    return onProjectsChanged(() => {
      async function loadContext() {
        try {
          setWorkspace(getCurrentWorkspace())
          setOrganization(getCurrentOrganization())
          setCurrentProjectEnv(getCurrentProjectEnv())

          const loadedProjects = await fetchProjects()
          const nextProjectEnv = chooseProjectEnv(loadedProjects)

          if (!nextProjectEnv) {
            denyEnvironmentAccess()
            return
          }

          saveCurrentProjectEnv(nextProjectEnv)

          setProjects(loadedProjects)
          setCurrentProjectEnv(nextProjectEnv)
        } catch {
          setProjects([])
        }
      }

      void loadContext()
    })
  }, [denyEnvironmentAccess])

  useEffect(() => {
    document.documentElement.lang = lang
    void i18n.changeLanguage(lang)
  }, [i18n, lang])

  useEffect(() => {
    let cancelled = false

    async function loadInitialContext() {
      try {
        setWorkspace(getCurrentWorkspace())
        setOrganization(getCurrentOrganization())
        setCurrentProjectEnv(getCurrentProjectEnv())

        const loadedProjects = await fetchProjects()

        if (cancelled) {
          return
        }

        const nextProjectEnv = chooseProjectEnv(loadedProjects)

        if (!nextProjectEnv) {
          denyEnvironmentAccess()
          return
        }

        saveCurrentProjectEnv(nextProjectEnv)

        setProjects(loadedProjects)
        setCurrentProjectEnv(nextProjectEnv)
      } catch {
        if (!cancelled) {
          setProjects([])
        }
      }
    }

    void loadInitialContext()

    return () => {
      cancelled = true
    }
  }, [denyEnvironmentAccess])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <GlobalMessageBanner message={globalMessage} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          lang={lang}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background px-5">
            <ContextBar
              organization={organization}
              currentProjectEnv={currentProjectEnv}
              projects={projects}
              onProjectEnvChange={changeCurrentProjectEnv}
            />
            <SubscriptionLicenseBadge lang={lang} workspace={workspace} />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
