import { Pencil } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { ParsedAnalysis } from "./measuring-types"

export function SampleCheck({
  analysis,
  minimumSample,
  onEdit,
}: {
  analysis: ParsedAnalysis
  minimumSample?: number | null
  onEdit?: () => void
}) {
  const { t } = useTranslation()
  const sample = analysis.sampleCheck
  if (!sample) return null

  const minimum =
    minimumSample === undefined ? sample.minimum : (minimumSample ?? 0)
  const minimumChanged = minimum !== sample.minimum

  const hasData =
    analysis.primary?.rows.some((row) => row.n > 0) &&
    Object.values(sample.variants).some((count) => count > 0)
  // The backend can report ok=true at zero samples when no minimum is set.
  const status = minimumChanged
    ? "sampleCheckNeedsAnalysis"
    : !hasData
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
      {minimum > 0 ? (
        <>
          <span>·</span>
          <span>
            {t(
              "releaseDecision.experiments.detailsPage.measuring.minimumPerVariant",
              { count: minimum }
            )}
          </span>
        </>
      ) : null}
      {onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t(
            "releaseDecision.experiments.detailsPage.measuring.editMinimumSample"
          )}
          onClick={onEdit}
        >
          <Pencil />
        </Button>
      ) : null}
      {minimumChanged ? (
        <p className="w-full">
          {t(
            "releaseDecision.experiments.detailsPage.measuring.minimumSampleChanged"
          )}
        </p>
      ) : null}
    </div>
  )
}
