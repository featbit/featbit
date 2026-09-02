import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getCurrentProjectEnv,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"

const tabs = [
  { key: "overview", href: "/release-health" },
  { key: "metrics", href: "/release-health/metrics" },
  { key: "connections", href: "/release-health/connections" },
  { key: "sessions", href: "/release-health/sessions" },
] as const

export function ReleaseHealthShell({
  activeTab,
  children,
  live = false,
}: {
  activeTab: (typeof tabs)[number]["key"]
  children: React.ReactNode
  live?: boolean
}) {
  const { t } = useTranslation()
  const params = useParams()
  const navigate = useNavigate()
  const lang = resolveLang(params.lang)
  const context = getCurrentProjectEnv()

  function onTabChange(value: string) {
    const tab = tabs.find((item) => item.key === value)
    if (tab) navigate(localizedPath(lang, tab.href))
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <header className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("releaseHealth.title")}
          </h1>
          <Badge variant="secondary">{t(live ? "releaseHealth.live.badge" : "releaseHealth.designPreview")}</Badge>
        </div>
        <p className="max-w-4xl text-sm text-muted-foreground">
          {t("releaseHealth.subtitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("releaseHealth.scopeSummary", {
            project: context?.projectName ?? "Project",
            environment: context?.envName ?? "Environment",
          })}
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="mb-6 [scrollbar-width:none] overflow-x-auto border-b [&::-webkit-scrollbar]:hidden"
      >
        <TabsList
          variant="line"
          className="flex min-w-max gap-8"
          aria-label={t("releaseHealth.tabs.aria")}
        >
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="px-0 py-2.5">
              {t(`releaseHealth.tabs.${tab.key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-5 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
        <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
        {t(live ? "releaseHealth.live.notice" : "releaseHealth.sampleDataNotice")}
      </div>

      {children}
    </div>
  )
}
