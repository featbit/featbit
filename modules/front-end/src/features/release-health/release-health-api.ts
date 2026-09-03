import { fetchApi } from "@/lib/api/authenticated-api"
import type {
  MetricResultContract,
  ReleaseMetricCategory,
  MetricSourceConnection,
} from "./release-health-types"
import type { SourceConnectionConfigurationDraft } from "./components/source-connection-provider-types"

export type ReleaseHealthScope = { projectId: string; envId: string }
// Prometheus v1 is one provider branch, not a universal provider credential schema.
export type PrometheusConnectionView = {
  id: string
  environmentId: string
  providerType: "prometheus-compatible"
  providerSchemaVersion: 1
  name: string
  providerConfig: { endpoint: string }
  authentication: MetricSourceConnection["authentication"]
  revision: number
  version: number
  status: "connected" | "unavailable"
  lastCheckedAt: string
}
export type LiveMetric = {
  description?: string | null
  category?: ReleaseMetricCategory | null
  fractionDigits?: number | null
  id: string
  projectId: string
  metricVersionId: string
  version: number
  key: string
  name: string
  resultSemantics: string
  resultContract: MetricResultContract
}

export type MetricDefinitionWrite = Pick<
  LiveMetric,
  | "key"
  | "name"
  | "description"
  | "category"
  | "fractionDigits"
  | "resultSemantics"
  | "resultContract"
>
export type LiveBinding = {
  id: string
  connectionId: string
  connectionRevision: number
  providerType: "prometheus-compatible"
  providerSchemaVersion: 1
  providerConfig: { promql: string; queryMode: "range"; step: string }
  revision: number
  validatedAt: string
}
export type LiveTrend = {
  source?: { providerType: string; connectionName: string; step: string } | null
  status: "not_connected" | "ready" | "no_data" | "stale"
  queriedAt: string
  resultContract: MetricResultContract
  points: { timestamp: string; value: number }[]
  freshnessSeconds: number | null
}
export const releaseHealthRoot = (scope: ReleaseHealthScope) =>
  `/api/v1/projects/${scope.projectId}/envs/${scope.envId}/release-health`
const metricsRoot = (projectId: string) =>
  `/api/v1/projects/${projectId}/release-health/metrics`
const body = (value: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
})
export function prometheusConnectionWrite(
  name: string,
  draft: SourceConnectionConfigurationDraft,
  version?: number
) {
  const authentication =
    draft.authentication === "basic"
      ? {
          type: draft.authentication,
          username: draft.prometheusBasicUsername.trim(),
        }
      : { type: draft.authentication }
  const value =
    draft.authentication === "basic"
      ? draft.prometheusBasicPassword
      : draft.prometheusBearerToken
  const secretUpdate =
    draft.authentication === "none"
      ? { operation: "remove" }
      : value.length
        ? {
            operation: "replace",
            [draft.authentication === "basic" ? "password" : "token"]: value,
          }
        : { operation: "keep" }
  return {
    name,
    providerType: "prometheus-compatible",
    providerSchemaVersion: 1,
    providerConfig: { endpoint: draft.endpoint.trim() },
    authentication,
    secretUpdate,
    expectedVersion: version ?? null,
  }
}
export function connectionForEditor(
  value: PrometheusConnectionView,
  environmentKey: string
): MetricSourceConnection {
  return {
    ...value,
    environmentKey,
    endpoint: value.providerConfig.endpoint,
    backendVersion: value.version,
    usedByBindings: 0,
  }
}
export const releaseHealthApi = {
  connections: (scope: ReleaseHealthScope) =>
    fetchApi<PrometheusConnectionView[]>(
      `${releaseHealthRoot(scope)}/connections`
    ),
  test: (scope: ReleaseHealthScope, value: unknown, id?: string) =>
    fetchApi<boolean>(
      `${releaseHealthRoot(scope)}/connections/${id ? `${id}/test-draft` : "test"}`,
      body(value)
    ),
  testSaved: (scope: ReleaseHealthScope, id: string) =>
    fetchApi<boolean>(`${releaseHealthRoot(scope)}/connections/${id}/test`, {
      method: "POST",
    }),
  save: (scope: ReleaseHealthScope, value: unknown, id?: string) =>
    fetchApi<PrometheusConnectionView>(
      `${releaseHealthRoot(scope)}/connections${id ? `/${id}` : ""}`,
      body(value, id ? "PUT" : "POST")
    ),
  metrics: (projectId: string) =>
    fetchApi<LiveMetric[]>(metricsRoot(projectId)),
  createMetric: (projectId: string, value: unknown) =>
    fetchApi<LiveMetric>(metricsRoot(projectId), body(value)),
  binding: (scope: ReleaseHealthScope, metricId: string) =>
    fetchApi<LiveBinding | null>(
      `${releaseHealthRoot(scope)}/metrics/${metricId}/binding`
    ),
  previewBinding: (
    scope: ReleaseHealthScope,
    metricId: string,
    value: unknown
  ) =>
    fetchApi<LiveTrend>(
      `${releaseHealthRoot(scope)}/metrics/${metricId}/binding/preview`,
      body(value)
    ),
  saveBinding: (scope: ReleaseHealthScope, metricId: string, value: unknown) =>
    fetchApi<LiveBinding>(
      `${releaseHealthRoot(scope)}/metrics/${metricId}/binding`,
      body(value, "PUT")
    ),
  trend: (scope: ReleaseHealthScope, metricId: string, minutes = 15) =>
    fetchApi<LiveTrend>(
      `${releaseHealthRoot(scope)}/metrics/${metricId}/trend?minutes=${minutes}`
    ),
}
