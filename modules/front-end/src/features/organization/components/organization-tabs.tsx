import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"

const tabs = [
  {
    key: "general",
    href: "/organization",
    labelKey: "organization.tabs.general",
  },
  {
    key: "projects",
    href: "/organization/projects",
    labelKey: "organization.tabs.projects",
  },
]

export function OrganizationTabs({
  lang,
  activeTab,
}: {
  lang: Lang
  activeTab: string
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()

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
      className="[scrollbar-width:none] overflow-x-auto border-b [&::-webkit-scrollbar]:hidden"
    >
      <TabsList variant="line" className="flex min-w-max gap-8">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} className="px-0 py-2.5">
            {t(tab.labelKey)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
