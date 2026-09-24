import { useQuery } from "@tanstack/react-query"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import {
  getCurrentOrganization,
  getCurrentWorkspace,
} from "@/features/layout/layout-context"
import { useMetricReadings } from "../metrics/live-metric-data"
import type { ReleaseHealthScope } from "../release-health-api"
import type { DataStatus, ReleaseMetric } from "../release-health-types"
import { monitorApi, type LiveMonitorBinding } from "./monitor-api"

export type BindingMetric = Pick<
  ReleaseMetric,
  "id" | "key" | "name" | "version" | "resultContract" | "fractionDigits"
> & {
  metricVersionId: string
  sourceConnected: boolean
  dataStatus: DataStatus | "loading" | "not-connected"
}

export const monitorQueryKey = (scope: ReleaseHealthScope, flagId: string) => [
  "release-health",
  "monitor",
  getStoredUserProfile().id ?? "",
  getCurrentWorkspace()?.id ?? "",
  getCurrentOrganization()?.id ?? "",
  scope.projectId,
  scope.envId,
  flagId,
]

export function useMonitorMetrics(
  scope: ReleaseHealthScope,
  flagId: string,
  bindings: LiveMonitorBinding[]
) {
  const catalog = useQuery({
    queryKey: [...monitorQueryKey(scope, flagId), "metrics"],
    queryFn: () => monitorApi.metrics(scope, flagId),
    enabled: Boolean(scope.projectId && scope.envId && flagId),
    retry: false,
  })
  const entries = new Map(
    (catalog.data ?? []).map((metric) => [metric.id, metric])
  )
  // Bound versions use their saved contract even if the project metric changes.
  for (const binding of bindings)
    entries.set(binding.metricId, {
      ...binding.metric,
      sourceConnected: binding.sourceConnected,
    })
  const metrics = [...entries.values()]
  const connected = metrics.filter((metric) => metric.sourceConnected)
  const readings = useMetricReadings(scope, connected)
  const byId = new Map(
    connected.map((metric, index) => [metric.id, readings[index]])
  )
  return {
    ...catalog,
    metrics: metrics.map((metric): BindingMetric => {
      const reading = byId.get(metric.id)
      const status = reading?.data?.status
      return {
        ...metric,
        fractionDigits: metric.fractionDigits ?? 2,
        dataStatus:
          !metric.sourceConnected || status === "not_connected"
            ? "not-connected"
            : reading?.isError
              ? "error"
              : reading?.isPending
                ? "loading"
                : status === "no_data"
                  ? "no-data"
                  : status === "ready" || status === "stale"
                    ? status
                    : "collecting",
      }
    }),
  }
}
