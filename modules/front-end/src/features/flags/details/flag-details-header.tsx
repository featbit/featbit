import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DetailBackLink } from "@/components/detail-back-link"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { FeatureFlag } from "../flags-types"

const tabs = [
  "targeting",
  "variations",
  "settings",
  "triggers",
  "release-health",
  "insights",
  "history",
] as const

export function FlagDetailsHeader({
  flag,
  basePath,
  activeTab,
}: {
  flag: FeatureFlag
  basePath: string
  activeTab: (typeof tabs)[number]
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copyKey() {
    await navigator.clipboard.writeText(flag.key)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <header>
      <DetailBackLink to={basePath}>
        {t("featureFlags.detailsPage.featureFlags")}
      </DetailBackLink>
      <div className="min-w-0">
        <Tooltip>
          <TooltipTrigger className="block max-w-full min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-normal">
              {flag.name}
            </h1>
          </TooltipTrigger>
          <TooltipContent>{flag.name}</TooltipContent>
        </Tooltip>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {t("featureFlags.status")}
            </span>
            <Badge variant="outline" className="gap-1.5 font-semibold">
              <span
                className={
                  flag.isEnabled
                    ? "size-1.5 rounded-full bg-emerald-600"
                    : "size-1.5 rounded-full bg-muted-foreground"
                }
              />
              {flag.isEnabled ? t("featureFlags.on") : t("featureFlags.off")}
            </Badge>
          </div>
          <Badge variant="secondary" className="font-normal">
            {t(
              flag.isArchived
                ? "featureFlags.detailsPage.archived"
                : "featureFlags.detailsPage.active"
            )}
          </Badge>
          <Badge variant="outline" className="font-normal">
            {flag.variationType.toUpperCase()}
          </Badge>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{t("featureFlags.detailsPage.key")}</span>
            <div className="flex h-8 items-center rounded-md border bg-background pl-3 font-mono text-xs text-foreground">
              <span className="max-w-64 truncate">{flag.key}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-1"
                aria-label={t("featureFlags.detailsPage.copyKey")}
                onClick={() => void copyKey()}
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
          {flag.tags?.length ? (
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>{t("featureFlags.detailsPage.tags")}</span>
              {flag.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <nav
        className="mt-6 flex h-11 items-end gap-0 border-b"
        aria-label={t("featureFlags.detailsPage.tabsLabel")}
      >
        {tabs.map((tab) => {
          const active = tab === activeTab
          const className = active
            ? "border-b-2 border-foreground px-3 pb-3 text-sm font-medium text-foreground"
            : "px-3 pb-3 text-sm text-muted-foreground"
          return (
            <Link
              key={tab}
              to={`${basePath}/${encodeURIComponent(flag.key)}/${tab}`}
              className={className}
              aria-current={active ? "page" : undefined}
            >
              {t(`featureFlags.detailsPage.tabs.${tab}`)}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
