import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { DetailBackLink } from "@/components/detail-back-link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  fetchProjects,
  getCurrentProjectEnv,
  getCurrentOrganization,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { LiveBindingEditor } from "./live-source-binding-editor"
import { useLiveMetrics, useMetricPermissions } from "./live-metric-data"
import { SourceBindingContract } from "./source-binding-contract"

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
          <header className="mb-5">
            <p className="mb-1 text-sm text-muted-foreground">
              {t("releaseHealth.live.manageBinding")}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight break-words">
              {metric.name}
            </h1>
            <code className="mt-2 block text-sm break-all text-muted-foreground">
              {metric.key}
            </code>
          </header>
          {context.envId !== environment.id ? (
            <Alert className="mb-4">
              <AlertDescription>
                {t("releaseHealth.live.urlEnvironment", {
                  environment: environment.name,
                })}
              </AlertDescription>
            </Alert>
          ) : null}
          <SourceBindingContract metric={metric} />
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
