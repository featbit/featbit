import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import {
  getCurrentProjectEnv,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import type { ProjectEnv } from "@/features/layout/layout-types"
import { ApiRequestError } from "@/lib/api/authenticated-api"
import {
  releaseHealthApi,
  type MetricDefinitionWrite,
} from "../release-health-api"
import { MetricCatalog } from "./release-metrics-page"
import {
  metricListKey,
  useCatalogEntries,
  useLiveMetrics,
  useMetricPermissions,
} from "./live-metric-data"

export function ReleaseMetricsPage() {
  const context = getCurrentProjectEnv()
  return context ? <Metrics key={context.projectId} context={context} /> : null
}

function Metrics({ context }: { context: ProjectEnv }) {
  const query = useLiveMetrics(context.projectId)
  const metrics = useCatalogEntries(context, query.data ?? [])
  const permissions = useMetricPermissions(context.projectKey, context.envKey)
  const client = useQueryClient()
  const navigate = useNavigate()
  const lang = resolveLang(useParams().lang)
  async function create(value: MetricDefinitionWrite) {
    if (query.data?.some((metric) => metric.key === value.key))
      throw new Error("metric_key_exists")
    try {
      const metric = await releaseHealthApi.createMetric(
        context.projectId,
        value
      )
      await client.invalidateQueries({
        queryKey: metricListKey(context.projectId),
      })
      navigate(
        localizedPath(
          lang,
          `/release-health/metrics/${encodeURIComponent(metric.key)}`
        )
      )
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409)
        throw new Error("metric_key_exists", { cause: error })
      throw error
    }
  }
  return (
    <MetricCatalog
      metrics={metrics}
      loading={query.isPending}
      failed={query.isError}
      canCreate={permissions.canCreate}
      onCreate={create}
    />
  )
}
