import { CircleHelp } from "lucide-react"
import { useId } from "react"
import { Trans, useTranslation } from "react-i18next"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { analysisValueColumn } from "./measuring-utils"

export function AnalysisValueHeader({
  column,
  context = "bayesian",
}: {
  column: ReturnType<typeof analysisValueColumn>
  context?: "bayesian" | "banditPrimary" | "banditGuardrail"
}) {
  const { t } = useTranslation()
  const helpId = useId()
  const label = t(`releaseDecision.experiments.detailsPage.measuring.${column}`)

  return (
    <span className="inline-flex items-center justify-end gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger
          delay={150}
          aria-describedby={helpId}
          aria-label={t(
            "releaseDecision.experiments.detailsPage.measuring.valueColumnHelp",
            { column: label }
          )}
          className="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent id={helpId} role="tooltip">
          <span className="text-left leading-snug whitespace-normal">
            <Trans
              i18nKey={`releaseDecision.experiments.detailsPage.measuring.${context === "bayesian" ? "valueColumnTooltips" : "banditValueColumnTooltips"}.${column}`}
              components={{ code: <code className="font-mono" /> }}
            />
            {context !== "bayesian" ? (
              <>
                {" "}
                {t(
                  `releaseDecision.experiments.detailsPage.measuring.${context}ComparisonHelp`
                )}
              </>
            ) : null}
          </span>
        </TooltipContent>
      </Tooltip>
    </span>
  )
}
