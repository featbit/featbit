import { CircleAlert, Eye } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ChangeRequestPreview } from "../change-requests-types"

export function ChangeRequestPreviewAlert({
  preview,
  failed,
  onRetry,
  onExit,
}: {
  preview?: ChangeRequestPreview
  failed: boolean
  onRetry: () => void
  onExit: () => void
}) {
  const { t } = useTranslation()

  if (failed) {
    return (
      <Alert variant="destructive" className="mt-4">
        <CircleAlert />
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <AlertTitle>
              {t("featureFlags.detailsPage.preview.loadFailed")}
            </AlertTitle>
            <AlertDescription>
              {t("featureFlags.detailsPage.preview.loadFailedHelp")}
            </AlertDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onRetry}>
              {t("featureFlags.detailsPage.preview.retry")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onExit}>
              {t("featureFlags.detailsPage.preview.viewCurrent")}
            </Button>
          </div>
        </div>
      </Alert>
    )
  }

  if (!preview) return null

  return (
    <Alert className="mt-4 border-sky-200 bg-sky-50/70 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
      <Eye />
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <AlertTitle className="flex flex-wrap items-center gap-2">
            <span>
              {t(
                preview.status === "Applied"
                  ? "featureFlags.detailsPage.preview.appliedTitle"
                  : "featureFlags.detailsPage.preview.title"
              )}
            </span>
            <Badge variant="outline" className="border-current/25 text-current">
              {t(`featureFlags.detailsPage.pending.status.${preview.status}`)}
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-sky-900/80 dark:text-sky-100/80">
            <div>
              {t(
                preview.status === "Applied"
                  ? "featureFlags.detailsPage.preview.appliedDescription"
                  : "featureFlags.detailsPage.preview.description"
              )}
            </div>
            {preview.reason ? (
              <div className="mt-1 truncate" title={preview.reason}>
                <span className="font-medium text-sky-950 dark:text-sky-100">
                  {t("featureFlags.detailsPage.preview.reason")}
                </span>{" "}
                {preview.reason}
              </div>
            ) : null}
          </AlertDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 bg-background/70"
          onClick={onExit}
        >
          {t("featureFlags.detailsPage.preview.viewCurrent")}
        </Button>
      </div>
    </Alert>
  )
}
