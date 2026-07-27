import { Check, Copy, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { FeatureFlag } from "../flags-types"

const tabs = [
  "targeting",
  "variations",
  "triggers",
  "insights",
  "settings",
  "history",
] as const

export function FlagDetailsHeader({
  flag,
  basePath,
  toggling,
  canToggle,
  onToggle,
}: {
  flag: FeatureFlag
  basePath: string
  toggling: boolean
  canToggle: boolean
  onToggle: () => void
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
      <Link
        to={basePath}
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        <span aria-hidden>←</span>
        {t("featureFlags.detailsPage.featureFlags")}
      </Link>
      <div className="mt-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Tooltip>
            <TooltipTrigger className="block max-w-full">
              <h1 className="truncate text-2xl font-semibold tracking-normal">
                {flag.name}
              </h1>
            </TooltipTrigger>
            <TooltipContent>{flag.name}</TooltipContent>
          </Tooltip>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
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
        <div className="flex h-9 shrink-0 items-center gap-2 pt-1">
          {toggling ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : null}
          <Switch
            checked={flag.isEnabled}
            disabled={toggling || !canToggle || flag.isArchived}
            aria-label={t("featureFlags.detailsPage.toggleStatus")}
            onCheckedChange={onToggle}
          />
          <span className="text-sm font-semibold">
            {flag.isEnabled ? "ON" : "OFF"}
          </span>
        </div>
      </div>
      <nav
        className="mt-6 flex h-11 items-end gap-0 border-b"
        aria-label={t("featureFlags.detailsPage.tabsLabel")}
      >
        {tabs.map((tab) => {
          const active = tab === "targeting"
          return (
            <span
              key={tab}
              className={
                active
                  ? "border-b-2 border-foreground px-3 pb-3 text-sm font-medium text-foreground"
                  : "px-3 pb-3 text-sm text-muted-foreground"
              }
            >
              {t(`featureFlags.detailsPage.tabs.${tab}`)}
            </span>
          )
        })}
      </nav>
    </header>
  )
}
