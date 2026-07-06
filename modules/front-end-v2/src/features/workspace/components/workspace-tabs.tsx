import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { localizedPath } from "@/features/layout/layout-context"
import { getRuntimeEnv } from "@/lib/env/runtime-env"

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
  const navigate = useNavigate()
  const tabs = workspaceTabs.filter(
    (tab) => tab.key !== "billing" || getRuntimeEnv().hostingMode === "saas"
  )

  function onTabChange(value: string) {
    const tab = tabs.find((item) => item.key === value)
    if (tab) {
      navigate(localizedPath(lang, tab.href))
    }
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      className="overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <TabsList
        variant="line"
        className="flex min-w-max gap-8"
        aria-label={t("workspace.tabs.aria")}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            className="px-0 py-2.5"
          >
            {t(tab.labelKey)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
