import { useQuery, useQueries } from "@tanstack/react-query"
import { fetchAuditLogs } from "@/features/audit-logs/audit-logs-api"
import {
  releaseHealthApi,
  type LiveMetric,
  type ReleaseHealthScope,
  type MetricChange,
} from "../release-health-api"

export function useMetricDetailData(
  scope: ReleaseHealthScope,
  metric: LiveMetric,
  from: number,
  to: number
) {
  const start = new Date(from).toISOString(),
    end = new Date(to).toISOString()
  const prefix = ["release-health", scope.projectId, scope.envId, metric.id]
  const trend = useQuery({
    queryKey: [...prefix, metric.metricVersionId, "range", start, end],
    queryFn: () => releaseHealthApi.range(scope, metric.id, start, end),
    retry: false,
  })
  const monitors = useQuery({
    queryKey: [...prefix, "monitor-bindings"],
    queryFn: () => releaseHealthApi.monitorBindings(scope, metric.id),
    retry: false,
  })
  const changes = useQuery({
    queryKey: [...prefix, "changes", start, end],
    queryFn: () => releaseHealthApi.changes(scope, metric.id, start, end),
    retry: false,
  })
  const flags = [
    ...new Map((monitors.data ?? []).map((x) => [x.flagId, x])).values(),
  ]
  const flagChanges = useQueries({
    queries: flags.map((binding) => ({
      queryKey: [...prefix, "flag-changes", binding.flagId, start, end],
      retry: false,
      queryFn: async () => {
        const result: MetricChange[] = []
        let index = 0
        let total: number
        do {
          const page = await fetchAuditLogs(
            scope.envId,
            {
              query: "",
              refType: "FeatureFlag",
              refId: binding.flagId,
              from,
              to,
              crossEnvironment: false,
            },
            index++,
            100
          )
          total = page.totalCount
          result.push(
            ...page.items
              .filter((log) => log.creatorEmail !== "System")
              .map((log) => ({
                id: log.id,
                metricId: metric.id,
                environmentId: scope.envId,
                metricVersion: binding.metricVersion,
                kind: "flag" as const,
                operation: `${binding.flagKey} · ${log.operation}`,
                occurredAt: log.createdAt,
                actorId: log.creatorId,
                actorName: log.creatorName || log.creatorId,
                source:
                  log.creatorEmail === "Access token"
                    ? "API"
                    : log.creatorEmail === "System"
                      ? "System"
                      : "UI",
                fields: [
                  {
                    field: "configuration",
                    before: log.dataChange.previous ?? null,
                    after: log.dataChange.current ?? null,
                  },
                ],
              }))
          )
          if (!page.items.length) break
        } while (index * 100 < total)
        return result
      },
    })),
  })
  return {
    trend,
    monitors,
    changes,
    events: [
      ...(changes.data ?? []),
      ...flagChanges.flatMap((x) => x.data ?? []),
    ].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)),
    eventsLoading:
      changes.isPending ||
      monitors.isPending ||
      flagChanges.some((x) => x.isPending),
    eventsFailed:
      changes.isError || monitors.isError || flagChanges.some((x) => x.isError),
  }
}
