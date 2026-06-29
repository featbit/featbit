import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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

  return (
    <div className="overflow-x-auto border-b border-border">
      <nav className="flex min-w-max gap-8" aria-label={t("workspace.tabs.aria")}>
        {workspaceTabs.map((tab) => (
          <Link
            key={tab.key}
            to={localizedPath(lang, tab.href)}
            className={cn(
              "relative px-0 py-3 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-transparent after:content-['']",
              activeTab === tab.key
                ? "text-blue-600 after:bg-blue-600 dark:text-blue-400 dark:after:bg-blue-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(tab.labelKey)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
