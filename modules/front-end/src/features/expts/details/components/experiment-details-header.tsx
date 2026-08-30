import { Bot, ChevronLeft, Settings } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
import type { ExperimentDetail } from "../experiment-details-types"

type Props = {
  experiment: ExperimentDetail
  lang: Lang
  settingsActive: boolean
  onAgentSetup: () => void
  onSettings: () => void
}

export function ExperimentDetailsHeader({
  experiment,
  lang,
  settingsActive,
  onAgentSetup,
  onSettings,
}: Props) {
  const { t } = useTranslation()

  return (
    <header className="space-y-5">
      <Link
        to={localizedPath(lang, "/experiments")}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeft className="size-4" />
        {t("releaseDecision.experiments.title")}
      </Link>

      <div className="flex min-w-0 items-start justify-between gap-6">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1
              className="max-w-[min(42rem,60vw)] truncate text-2xl font-semibold tracking-normal"
              title={experiment.name}
            >
              {experiment.name}
            </h1>
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span className="size-1.5 rounded-full bg-foreground" />
              {t(`releaseDecision.experiments.stages.${experiment.stage}`)}
            </Badge>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            {experiment.description ? (
              <p
                className="mr-2 max-w-[min(34rem,48vw)] truncate text-muted-foreground"
                title={experiment.description}
              >
                {experiment.description}
              </p>
            ) : null}
            <Badge variant="outline" className="max-w-72 gap-1 font-normal">
              <span className="shrink-0">
                {t("releaseDecision.experiments.detailsPage.featureFlag")}
                <span className="px-1 text-muted-foreground">·</span>
              </span>
              <span
                className="truncate"
                title={experiment.flagKey ?? undefined}
              >
                {experiment.flagKey ||
                  t("releaseDecision.experiments.notBound")}
              </span>
            </Badge>
            <Badge variant="outline" className="font-normal">
              {experiment.runCount
                ? t("releaseDecision.experiments.runCount", {
                    count: experiment.runCount,
                  })
                : t("releaseDecision.experiments.noRuns")}
            </Badge>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" onClick={onAgentSetup}>
            <Bot />
            {t("releaseDecision.experiments.detailsPage.agentSetup.title")}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant={settingsActive ? "secondary" : "outline"}
                  size="icon"
                  aria-label={t(
                    "releaseDecision.experiments.detailsPage.settings.title"
                  )}
                  className={cn(settingsActive && "bg-muted")}
                  onClick={onSettings}
                />
              }
            >
              <Settings />
            </TooltipTrigger>
            <TooltipContent>
              {t("releaseDecision.experiments.detailsPage.settings.title")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
