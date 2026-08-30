import { useTranslation } from "react-i18next"
import type { ExperimentStage } from "../../index/experiment-types"
import { cn } from "@/lib/utils"

const STAGES: ExperimentStage[] = [
  "hypothesis",
  "implementing",
  "measuring",
  "learning",
]

export function ExperimentStageNavigation({
  activeStage,
  onStageSelect,
}: {
  activeStage: ExperimentStage
  onStageSelect: (stage: ExperimentStage) => void
}) {
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t("releaseDecision.experiments.detailsPage.stageNavigation")}
      className="overflow-x-auto rounded-lg border bg-background"
    >
      <ol className="grid min-w-[820px] grid-cols-4">
        {STAGES.map((stage, index) => {
          const active = stage === activeStage
          return (
            <li key={stage} className="min-w-0">
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                className="flex h-full w-full min-w-0 cursor-pointer items-start gap-3 rounded-lg px-4 py-5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => onStageSelect(stage)}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {t(`releaseDecision.experiments.stages.${stage}`)}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted-foreground">
                    {t(
                      `releaseDecision.experiments.detailsPage.stageSubtitles.${stage}`
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
