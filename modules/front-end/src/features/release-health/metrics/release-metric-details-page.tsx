import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  getCurrentProjectEnv,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { useLiveMetrics } from "./live-metric-data"
import { MetricDetailsView } from "./metric-details-view"

export function ReleaseMetricDetailsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const context = getCurrentProjectEnv()
  const metrics = useLiveMetrics(context?.projectId ?? "")
  const metric = metrics.data?.find((item) => item.key === params.metricKey)
  if (metrics.isPending || metrics.isError)
    return (
      <Alert variant={metrics.isError ? "destructive" : "default"}>
        <AlertDescription>
          {t(
            metrics.isError
              ? "releaseHealth.live.loadFailed"
              : "releaseHealth.live.loading"
          )}
        </AlertDescription>
      </Alert>
    )
  if (metric && context)
    return (
      <MetricDetailsView
        key={`${context.projectId}:${context.envId}:${metric.metricVersionId}`}
        metric={metric}
        context={context}
      />
    )
  return (
    <div className="flex min-h-80 items-center justify-center">
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          {t("releaseHealth.metrics.detail.notFound")}
        </p>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link to={localizedPath(lang, "/release-health/metrics")} />}
        >
          {t("releaseHealth.metrics.detail.back")}
        </Button>
      </div>
    </div>
  )
}
