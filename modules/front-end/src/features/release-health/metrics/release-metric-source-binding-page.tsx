import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { DetailBackLink } from "@/components/detail-back-link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  fetchProjects,
  getCurrentProjectEnv,
  getCurrentOrganization,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { LiveBindingEditor } from "./live-source-binding-editor"
import { useLiveMetrics, useMetricPermissions } from "./live-metric-data"
import { metricResultProfileLabel } from "./metric-contract"

export function ReleaseMetricSourceBindingPage() {
  const { t } = useTranslation()
  const params = useParams()
  const navigate = useNavigate()
  const lang = resolveLang(params.lang)
  const context = getCurrentProjectEnv()
  const metrics = useLiveMetrics(context?.projectId ?? "")
  const projects = useQuery({
    queryKey: [
      "release-health",
      getCurrentOrganization()?.id ?? "",
      "accessible-projects",
    ],
    queryFn: fetchProjects,
    retry: false,
  })
  const metric = metrics.data?.find((item) => item.key === params.metricKey)
  const environment = projects.data
    ?.find((item) => item.id === context?.projectId)
    ?.environments.find((item) => item.key === params.environmentKey)
  const permissions = useMetricPermissions(
    context?.projectKey ?? "",
    environment?.key ?? ""
  )
  const detailPath = localizedPath(
    lang,
    `/release-health/metrics/${encodeURIComponent(params.metricKey ?? "")}`
  )
  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <DetailBackLink to={detailPath}>
        {metric?.name ?? t("releaseHealth.tabs.metrics")}
      </DetailBackLink>
      {metrics.isPending || projects.isPending ? (
        <p>{t("releaseHealth.live.loading")}</p>
      ) : metrics.isError || projects.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("releaseHealth.live.loadFailed")}
          </AlertDescription>
        </Alert>
      ) : !metric || !environment || !context ? (
        <p>{t("releaseHealth.metrics.detail.notFound")}</p>
      ) : !permissions.canConfigure ? (
        <Alert>
          <AlertDescription>
            {t("releaseHealth.live.bindingLoadFailed")}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <header className="mb-6">
            <h1 className="text-2xl font-semibold">
              {t("releaseHealth.live.manageBinding")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("releaseHealth.metrics.sourceBinding.description", {
                metric: metric.name,
                environment: environment.name,
              })}
            </p>
          </header>
          <Alert className="mb-5">
            <AlertDescription>
              {t("releaseHealth.metrics.sourceBinding.boundaryNotice")}
            </AlertDescription>
          </Alert>
          {context.envId !== environment.id ? (
            <Alert className="mb-4">
              <AlertDescription>
                {t("releaseHealth.live.urlEnvironment", {
                  environment: environment.name,
                })}
              </AlertDescription>
            </Alert>
          ) : null}
          <Card size="sm" className="mb-4">
            <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  {t("releaseHealth.metrics.sourceBinding.metric")}
                </p>
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {metric.name}
                  <Badge variant="outline">v{metric.version}</Badge>
                </p>
              </div>
              <code className="text-xs break-all">{metric.key}</code>
              <p className="text-xs text-muted-foreground">
                {metricResultProfileLabel(t, metric)} ·{" "}
                {t("releaseHealth.resultContract.singleSeries")}
              </p>
            </CardContent>
          </Card>
          <LiveBindingEditor
            key={context.projectId + environment.id + metric.id}
            scope={{ projectId: context.projectId, envId: environment.id }}
            metric={metric}
            environmentName={environment.name}
            onSaved={() => navigate(detailPath)}
            onCancel={() => navigate(detailPath)}
          />
        </>
      )}
    </div>
  )
}
