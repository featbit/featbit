import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { localizedPath } from "@/features/layout/layout-context"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import { cn } from "@/lib/utils"

const workspaceTabs = [
  { key: "general", href: "/app/workspace", labelKey: "workspace.tabs.general" },
  { key: "license", href: "/app/workspace/license", labelKey: "workspace.tabs.license" },
  { key: "usage", href: "/app/workspace/usage", labelKey: "workspace.tabs.usage" },
  { key: "billing", href: "/app/workspace/billing", labelKey: "workspace.tabs.billing" },
  {
    key: "global-users",
    href: "/app/workspace/global-users",
    labelKey: "workspace.tabs.globalUsers",
  },
]

export function WorkspaceTabs({
  lang,
  activeTab,
}: {
  lang: "en" | "zh"
  activeTab: string
}) {
  const { t } = useTranslation()
  const tabs = workspaceTabs.filter(
    (tab) => tab.key !== "billing" || getRuntimeEnv().hostingMode === "saas"
  )

  return (
    <nav
      className="overflow-x-auto border-b"
      aria-label={t("workspace.tabs.aria")}
    >
      <div className="flex min-w-max gap-8">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            to={localizedPath(lang, tab.href)}
            className={cn(
              "relative py-2.5 text-sm font-medium text-muted-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-transparent after:content-[''] hover:text-foreground",
              activeTab === tab.key &&
                "text-blue-600 after:bg-blue-600 dark:text-blue-400 dark:after:bg-blue-500"
            )}
          >
            {t(tab.labelKey)}
          </Link>
        ))}
      </div>
    </nav>
  )
}
