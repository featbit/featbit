import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useLocation, useParams } from "react-router-dom"
import { ContextBar } from "@/features/layout/components/context-bar"
import {
  chooseProjectEnv,
  fetchProjects,
  getCurrentOrganization,
  getCurrentProjectEnv,
  getCurrentWorkspace,
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

const SIDEBAR_STORAGE_KEY = "featbit:sidebar-collapsed"
const UI_BROADCAST_CHANNEL = "featbit-ui-broadcast-channel"
const ENV_CHANGED_MESSAGE = "env-changed"

function getEnvironmentReloadPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  const [lang, appSegment, featureSegment] = segments

  if (lang && appSegment === "app" && featureSegment) {
    return `/${lang}/app/${featureSegment}`
  }

  if (lang && appSegment === "app") {
    return `/${lang}/app`
  }

  return pathname || "/"
}

export function AuthenticatedLayout() {
  const { lang: langParam } = useParams()
  const location = useLocation()
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
  const [currentProjectEnv, setCurrentProjectEnv] =
    useState<ProjectEnv | null>(() => getCurrentProjectEnv())
  const [projects, setProjects] = useState<Project[]>([])

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

    saveCurrentProjectEnv(nextProjectEnv)
    setCurrentProjectEnv(nextProjectEnv)
    if ("BroadcastChannel" in window) {
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
      if (event.data === ENV_CHANGED_MESSAGE) {
        window.location.assign(getEnvironmentReloadPath(location.pathname))
      }
    }

    return () => {
      channel.close()
    }
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.lang = lang
    void i18n.changeLanguage(lang)
  }, [i18n, lang])

  useEffect(() => {
    let cancelled = false

    async function loadContext() {
      try {
        setWorkspace(getCurrentWorkspace())
        setOrganization(getCurrentOrganization())
        setCurrentProjectEnv(getCurrentProjectEnv())

        const loadedProjects = await fetchProjects()

        if (cancelled) {
          return
        }

        const nextProjectEnv = chooseProjectEnv(loadedProjects)

        if (nextProjectEnv) {
          saveCurrentProjectEnv(nextProjectEnv)
        }

        setProjects(loadedProjects)
        setCurrentProjectEnv(nextProjectEnv)
      } catch {
        if (!cancelled) {
          setProjects([])
        }
      }
    }

    void loadContext()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar lang={lang} collapsed={collapsed} setCollapsed={setCollapsed} />
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
  )
}
