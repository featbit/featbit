import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom"
import { getStoredUserProfile, signOut } from "@/features/auth/auth-api"
import {
  authContextQueryKeys,
  projectsQueryOptions,
} from "@/features/layout/auth-context-query"
import { ContextBar } from "@/features/layout/components/context-bar"
import { GlobalMessageBanner } from "@/features/layout/components/global-message-banner"
import { buildBillingGlobalMessages } from "@/features/layout/global-message"
import {
  chooseProjectEnv,
  clearTabProjectEnv,
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
const ENVIRONMENT_SWITCH_DELAY_MS = 500
const BROADCAST_SOURCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`

function getBrowserPath(pathname: string, baseHref: string) {
  const absolutePathname = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${baseHref}${absolutePathname}` || "/"
}

function getEnvironmentReloadPath(pathname: string, baseHref: string) {
  const segments = pathname.split("/").filter(Boolean)
  const [lang, featureSegment] = segments

  if (lang && featureSegment) {
    return getBrowserPath(`/${lang}/${featureSegment}`, baseHref)
  }

  if (lang) {
    return getBrowserPath(`/${lang}`, baseHref)
  }

  return getBrowserPath(pathname || "/", baseHref)
}

export function AuthenticatedLayout() {
  const { lang: langParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const lang = resolveLang(langParam)
  const { i18n, t } = useTranslation()
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
  const [switchingProjectEnv, setSwitchingProjectEnv] =
    useState<ProjectEnv | null>(null)
  const environmentSwitchTimeoutRef = useRef<number | null>(null)
  const environmentSwitchOriginRef = useRef<string | null>(null)
  const { baseHref, hostingMode } = getRuntimeEnv()
  const isSaas = hostingMode === HOSTING_MODE_SAAS
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
    flushSync(() => {
      setSwitchingProjectEnv(nextProjectEnv)
    })
    saveCurrentProjectEnv(nextProjectEnv)
    setCurrentProjectEnv(nextProjectEnv)
    if (!isTabScoped && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel(UI_BROADCAST_CHANNEL)
      channel.postMessage({
        type: ENV_CHANGED_MESSAGE,
        sourceId: BROADCAST_SOURCE_ID,
      })
      channel.close()
    }

    if (environmentSwitchTimeoutRef.current !== null) {
      window.clearTimeout(environmentSwitchTimeoutRef.current)
    }

    const switchOrigin = `${getBrowserPath(location.pathname, baseHref)}${location.search}${location.hash}`
    environmentSwitchOriginRef.current = switchOrigin
    environmentSwitchTimeoutRef.current = window.setTimeout(() => {
      environmentSwitchTimeoutRef.current = null
      environmentSwitchOriginRef.current = null

      const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (currentLocation !== switchOrigin) {
        setSwitchingProjectEnv(null)
        return
      }

      window.location.assign(
        getEnvironmentReloadPath(location.pathname, baseHref)
      )
    }, ENVIRONMENT_SWITCH_DELAY_MS)
  }

  useEffect(() => {
    const switchOrigin = environmentSwitchOriginRef.current
    const currentLocation = `${getBrowserPath(location.pathname, baseHref)}${location.search}${location.hash}`

    if (switchOrigin === null || currentLocation === switchOrigin) {
      return
    }

    if (environmentSwitchTimeoutRef.current !== null) {
      window.clearTimeout(environmentSwitchTimeoutRef.current)
      environmentSwitchTimeoutRef.current = null
    }
    environmentSwitchOriginRef.current = null
    setSwitchingProjectEnv(null)
  }, [baseHref, location.hash, location.pathname, location.search])

  useEffect(() => {
    return () => {
      if (environmentSwitchTimeoutRef.current !== null) {
        window.clearTimeout(environmentSwitchTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      return
    }

    const channel = new BroadcastChannel(UI_BROADCAST_CHANNEL)
    channel.onmessage = (event) => {
      const messageType =
        typeof event.data === "string" ? event.data : event.data?.type
      const sourceId =
        typeof event.data === "string" ? undefined : event.data?.sourceId

      if (
        messageType === ENV_CHANGED_MESSAGE &&
        sourceId !== BROADCAST_SOURCE_ID &&
        !hasTabProjectEnvOverride()
      ) {
        window.location.assign(
          getEnvironmentReloadPath(location.pathname, baseHref)
        )
      }

      if (messageType === ORG_CHANGED_MESSAGE) {
        clearTabProjectEnv()
        window.location.assign(getBrowserPath(`/${lang}`, baseHref))
      }
    }

    return () => {
      channel.close()
    }
  }, [baseHref, lang, location.pathname])

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

          const userId = getStoredUserProfile().id ?? ""
          const organizationId = getCurrentOrganization()?.id ?? ""
          await queryClient.invalidateQueries({
            queryKey: authContextQueryKeys.projects(userId, organizationId),
          })
          const loadedProjects = await queryClient.fetchQuery(
            projectsQueryOptions(userId, organizationId)
          )
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
  }, [denyEnvironmentAccess, queryClient])

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

        const userId = getStoredUserProfile().id ?? ""
        const organizationId = getCurrentOrganization()?.id ?? ""
        const loadedProjects = await queryClient.ensureQueryData(
          projectsQueryOptions(userId, organizationId)
        )

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
  }, [denyEnvironmentAccess, queryClient])

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
            {switchingProjectEnv ? (
              <div
                role="status"
                aria-live="polite"
                aria-label={t("layout.context.switchingEnvironment", {
                  project: switchingProjectEnv.projectName,
                  environment: switchingProjectEnv.envName,
                })}
                className="flex h-full min-h-32 flex-col items-center justify-center gap-3"
              >
                <Loader2
                  aria-hidden
                  className="size-7 animate-spin text-primary motion-reduce:animate-none"
                />
                <p className="text-sm font-medium text-foreground">
                  {t("layout.context.switchingEnvironment", {
                    project: switchingProjectEnv.projectName,
                    environment: switchingProjectEnv.envName,
                  })}
                </p>
              </div>
            ) : (
              <Suspense fallback={<div className="min-h-32" />}>
                <Outlet />
              </Suspense>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
