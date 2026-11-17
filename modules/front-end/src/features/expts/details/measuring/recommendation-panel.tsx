import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import type { MeasuringRun } from "./measuring-types"
import { normalizedDecision } from "./measuring-utils"

export function RecommendationPanel({ run }: { run: MeasuringRun }) {
  const { t } = useTranslation()
  const key = "releaseDecision.experiments.detailsPage.measuring"
  const decision = normalizedDecision(run.decision)
  const summary = run.decisionSummary?.trim()
  const reason = run.decisionReason?.trim()

  if (!decision && !summary && !reason) return null

  return (
    <section className="overflow-hidden rounded-lg border">
      <div className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{t(`${key}.recommendation`)}</h3>
          {decision ? <Badge variant="outline">{decision}</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {t(`${key}.recommendationGuidance`)}
        </p>
      </div>
      {summary ? (
        <div className="space-y-1 border-t px-4 py-3">
          <h4 className="text-sm font-medium">
            {t(`${key}.recommendationSummary`)}
          </h4>
          <p className="text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
            {summary}
          </p>
        </div>
      ) : null}
      {reason ? (
        <details className="border-t px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            {t(`${key}.recommendationReason`)}
          </summary>
          <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
            {reason}
          </p>
        </details>
      ) : null}
      <div className="space-y-2 border-t bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <p className="font-medium">{t(`${key}.historicalRecommendation`)}</p>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex gap-1">
            <dt>{t(`${key}.recommendationWindow`)}:</dt>
            <dd>{t(`${key}.notRecorded`)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>{t(`${key}.dataAsOf`)}:</dt>
            <dd>{t(`${key}.notRecorded`)}</dd>
          </div>
        </dl>
        <p className="leading-5">{t(`${key}.historicalRecommendationHelp`)}</p>
      </div>
    </section>
  )
}
