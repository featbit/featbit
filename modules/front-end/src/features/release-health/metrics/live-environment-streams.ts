import { useQueries, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import {
  fetchProjects,
  getCurrentOrganization,
} from "@/features/layout/layout-context"
import type { ProjectEnv } from "@/features/layout/layout-types"
import {
  canUseAction,
  environmentRn,
} from "@/features/iam/current-user-permissions"
import { currentUserPoliciesQueryOptions } from "@/features/iam/current-user-policy-query"
import { releaseHealthApi, type LiveMetric } from "../release-health-api"
import { metricTrendKey, metricValue } from "./live-metric-data"

export function useEnvironmentStreams(context: ProjectEnv, metric: LiveMetric) {
  const { t } = useTranslation()
  const organizationId = getCurrentOrganization()?.id ?? ""
  const projects = useQuery({
    queryKey: ["release-health", organizationId, "accessible-projects"],
    queryFn: fetchProjects,
    retry: false,
  })
  const policies = useQuery(currentUserPoliciesQueryOptions(organizationId))
  const environments =
    projects.data?.find((p) => p.id === context.projectId)?.environments ?? []
  const trends = useQueries({
    queries: environments.map((env) => ({
      queryKey: metricTrendKey(
        { projectId: context.projectId, envId: env.id },
        metric.id
      ),
      queryFn: () =>
        releaseHealthApi.trend(
          { projectId: context.projectId, envId: env.id },
          metric.id
        ),
      staleTime: 10000,
      refetchInterval: 30000,
      retry: false,
    })),
  })
  return {
    pending: projects.isPending,
    failed: projects.isError,
    rows: environments.map((env, index) => {
      const reading = trends[index]
      const summary = reading.data?.source
      const latest = reading.data?.points.at(-1)
      return {
        environmentKey: env.key ?? "",
        environmentName: env.name,
        connected:
          reading.data?.status !== "not_connected" && Boolean(reading.data),
        pending: reading.isPending,
        failed: reading.isError,
        canConfigure:
          policies.isSuccess &&
          canUseAction(
            policies.data,
            environmentRn(context.projectKey, env.key ?? ""),
            "UpdateEnvSettings"
          ),
        provider: summary?.providerType,
        connection: summary?.connectionName,
        step: summary?.step,
        syncInterval: t("releaseHealth.live.onDemand"),
        dataStatus: reading.isError
          ? ("error" as const)
          : reading.data?.status === "no_data"
            ? ("no-data" as const)
            : reading.data?.status === "ready" ||
                reading.data?.status === "stale"
              ? reading.data.status
              : undefined,
        latestValue: latest ? metricValue(metric, latest.value) : "—",
        freshness: latest
          ? new Date(latest.timestamp).toLocaleString()
          : undefined,
      }
    }),
  }
}
