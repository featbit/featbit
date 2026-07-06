import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useParams } from "react-router-dom"
import { ContextBar } from "@/features/layout/context-bar"
import {
  chooseProjectEnv,
  fetchProjects,
  fallbackProjects,
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
import { Sidebar } from "@/features/layout/sidebar"
import { SubscriptionLicenseBadge } from "@/features/layout/subscription-license-badge"

const SIDEBAR_STORAGE_KEY = "featbit:sidebar-collapsed"

export function AuthenticatedLayout() {
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const { i18n } = useTranslation()
  const [collapsed, setCollapsedState] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
  )
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    getCurrentWorkspace()
  )
  const [organization, setOrganization] = useState<Organization>(() =>
    getCurrentOrganization()
  )
  const [currentProjectEnv, setCurrentProjectEnv] = useState<ProjectEnv>(() =>
    getCurrentProjectEnv()
  )
  const [projects, setProjects] = useState<Project[]>(fallbackProjects)

  function setCollapsed(nextCollapsed: boolean) {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextCollapsed))
    setCollapsedState(nextCollapsed)
  }

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

        const nextProjects =
          loadedProjects.length > 0 ? loadedProjects : fallbackProjects
        const nextProjectEnv = chooseProjectEnv(nextProjects)

        saveCurrentProjectEnv(nextProjectEnv)

        setProjects(nextProjects)
        setCurrentProjectEnv(nextProjectEnv)
      } catch {
        if (!cancelled) {
          setProjects(fallbackProjects)
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
            setCurrentProjectEnv={setCurrentProjectEnv}
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
