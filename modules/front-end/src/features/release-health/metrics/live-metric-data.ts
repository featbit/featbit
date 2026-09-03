import { useQueries, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import {
  releaseHealthApi,
  type LiveMetric,
  type LiveTrend,
  type ReleaseHealthScope,
} from "../release-health-api"
import { getCurrentOrganization } from "@/features/layout/layout-context"
import { currentUserPoliciesQueryOptions } from "@/features/iam/current-user-policy-query"
import {
  canUseAction,
  projectRn,
  environmentRn,
} from "@/features/iam/current-user-permissions"

export const metricListKey = (projectId: string) => [
  "release-health",
  projectId,
  "metrics",
]
export const metricTrendKey = (
  scope: ReleaseHealthScope,
  metricId: string,
  minutes = 15
) => [
  "release-health",
  scope.projectId,
  scope.envId,
  metricId,
  "trend",
  minutes,
]

export function useMetricPermissions(projectKey: string, envKey: string) {
  const policies = useQuery(
    currentUserPoliciesQueryOptions(getCurrentOrganization()?.id ?? "")
  )
  return {
    canCreate:
      policies.isSuccess &&
      canUseAction(
        policies.data,
        projectRn(projectKey),
        "UpdateProjectSettings"
      ),
    canConfigure:
      policies.isSuccess &&
      canUseAction(
        policies.data,
        environmentRn(projectKey, envKey),
        "UpdateEnvSettings"
      ),
  }
}

export function useLiveMetrics(projectId: string) {
  return useQuery({
    queryKey: metricListKey(projectId),
    queryFn: () => releaseHealthApi.metrics(projectId),
    enabled: Boolean(projectId),
    retry: false,
  })
}

export function useMetricReadings(
  scope: ReleaseHealthScope,
  metrics: LiveMetric[],
  minutes = 15
) {
  return useQueries({
    queries: metrics.map((metric) => ({
      queryKey: metricTrendKey(scope, metric.id, minutes),
      queryFn: () => releaseHealthApi.trend(scope, metric.id, minutes),
      enabled: Boolean(scope.envId),
      refetchInterval: 30000,
      staleTime: 10000,
      retry: false,
    })),
  })
}

export function metricValue(metric: LiveMetric, value: number) {
  const unit = metric.resultContract.unit
  const number = value.toLocaleString(undefined, {
    maximumFractionDigits: metric.fractionDigits ?? 2,
  })
  const suffix =
    unit.kind === "percent"
      ? "%"
      : unit.kind === "duration"
        ? " ms"
        : unit.kind === "data"
          ? " B"
          : unit.kind === "rate"
            ? ` ${unit.numerator}/${unit.per}`
            : ""
  return `${number}${suffix}`
}

export function useCatalogEntries(
  scope: ReleaseHealthScope,
  metrics: LiveMetric[]
) {
  const { t } = useTranslation()
  const readings = useMetricReadings(scope, metrics)
  return metrics.map((metric, index) => {
    const reading = readings[index]
    const trend = reading.data
    const status = reading.isError
      ? "error"
      : reading.isPending
        ? "loading"
        : (trend?.status ?? "error")
    const latest = trend?.points.at(-1)
    return {
      ...metric,
      source: trend?.source,
      status,
      displayValue: latest
        ? `${status === "stale" || status === "error" ? t("releaseHealth.live.lastSuccessful") + " · " : ""}${metricValue(metric, latest.value)}`
        : "—",
      freshness:
        trend?.status === "not_connected"
          ? "—"
          : latest
            ? new Date(latest.timestamp).toLocaleString()
            : trend
              ? new Date(trend.queriedAt).toLocaleString()
              : "—",
    }
  })
}

export type CatalogEntry = ReturnType<typeof useCatalogEntries>[number]
export type MetricReading = {
  data?: LiveTrend
  isError: boolean
  isPending: boolean
}
