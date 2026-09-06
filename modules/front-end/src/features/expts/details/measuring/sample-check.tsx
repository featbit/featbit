import { useTranslation } from "react-i18next"
import type { ParsedAnalysis } from "./measuring-types"

export function SampleCheck({ analysis }: { analysis: ParsedAnalysis }) {
  const { t } = useTranslation()
  const sample = analysis.sampleCheck
  if (!sample) return null

  const hasData =
    analysis.primary?.rows.some((row) => row.n > 0) &&
    Object.values(sample.variants).some((count) => count > 0)
  // The backend can report ok=true at zero samples when no minimum is set.
  const status = !hasData
    ? "sampleCheckNoData"
    : sample.minimum <= 0
      ? "noMinimumSet"
      : sample.ok
        ? "passed"
        : "belowMinimum"

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <strong className="font-medium text-foreground">
        {t("releaseDecision.experiments.detailsPage.measuring.sampleCheck")}
      </strong>
      <span>·</span>
      <span>
        {t(`releaseDecision.experiments.detailsPage.measuring.${status}`)}
      </span>
      {sample.minimum > 0 ? (
        <>
          <span>·</span>
          <span>
            {t(
              "releaseDecision.experiments.detailsPage.measuring.minimumPerVariant",
              { count: sample.minimum }
            )}
          </span>
        </>
      ) : null}
    </div>
  )
}
