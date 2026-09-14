import { ArrowDown, ArrowUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"

export function AnalysisMetricHeader({
  kind,
  eventKey,
  inverse,
}: {
  kind: "primaryMetric" | "guardrail"
  eventKey: string
  inverse?: boolean
}) {
  const { t } = useTranslation()
  const DirectionIcon = inverse ? ArrowDown : ArrowUp

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h4 className="min-w-0 text-sm font-medium">
        {t(`releaseDecision.experiments.detailsPage.measuring.${kind}`)}{" "}
        <span className="font-normal break-all text-muted-foreground">
          · {eventKey}
        </span>
      </h4>
      <Badge variant="secondary" className="font-normal">
        {inverse === undefined ? (
          t(
            "releaseDecision.experiments.detailsPage.measuring.directionNotRecorded"
          )
        ) : (
          <>
            <DirectionIcon aria-hidden="true" />
            {t(
              `releaseDecision.experiments.detailsPage.exposure.${inverse ? "lowerIsBetter" : "higherIsBetter"}`
            )}
          </>
        )}
      </Badge>
    </div>
  )
}
