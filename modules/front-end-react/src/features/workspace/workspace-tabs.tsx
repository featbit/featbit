import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { localizedPath } from "@/features/layout/context";
import { cn } from "@/lib/utils";

const workspaceTabs = [
  { key: "general", href: "/workspace", labelKey: "workspace.tabs.general" },
  { key: "license", href: "/workspace/license", labelKey: "workspace.tabs.license" },
  { key: "usage", href: "/workspace/usage", labelKey: "workspace.tabs.usage" },
  { key: "billing", href: "/workspace/billing", labelKey: "workspace.tabs.billing" },
  { key: "global-users", href: "/workspace/global-users", labelKey: "workspace.tabs.globalUsers" }
];

export function WorkspaceTabs({ lang, activeTab }: { lang: "en" | "zh"; activeTab: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  function onTabChange(value: string) {
    const tab = workspaceTabs.find((item) => item.key === value);
    if (tab) {
      navigate(localizedPath(lang, tab.href));
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="overflow-x-auto border-b border-border">
      <TabsList className="flex min-w-max gap-8" aria-label={t("workspace.tabs.aria")}>
        {workspaceTabs.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            asChild
            className={cn(
              "relative px-0 py-2.5 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-transparent after:content-['']",
              activeTab === tab.key
                ? "text-blue-600 after:bg-blue-600 dark:text-blue-400 dark:after:bg-blue-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Link to={localizedPath(lang, tab.href)}>{t(tab.labelKey)}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
