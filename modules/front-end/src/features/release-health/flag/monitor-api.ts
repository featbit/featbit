import { fetchApi } from "@/lib/api/authenticated-api"
import {
  releaseHealthRoot,
  type LiveMetric,
  type ReleaseHealthScope,
} from "../release-health-api"
import type { BindingAlertRule, MonitorBinding } from "../release-health-types"

export type MonitorMetric = LiveMetric & { sourceConnected: boolean }
export type LiveMonitorBinding = MonitorBinding & {
  id: string
  metricVersionId: string
  metricVersion: number
  metric: LiveMetric
  sourceConnected: boolean
  createdAt: string
  revision: number
}
export type LiveMonitor = {
  flagId: string
  enabled: boolean
  revision: number
  bindings: LiveMonitorBinding[]
}
export type MonitorStatusWrite = { expectedRevision: number; enabled: boolean }
export type MonitorBindingWrite = {
  expectedRevision: number
  metricId: string
  metricVersionId: string
  purpose: "guard" | "trend"
  rules: Omit<BindingAlertRule, "latestCheck">[]
}
const root = (scope: ReleaseHealthScope, flagId: string) =>
  `${releaseHealthRoot(scope)}/flags/${flagId}/monitor`
const body = (value: unknown, method: string): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
})

export const monitorApi = {
  get: (scope: ReleaseHealthScope, flagId: string) =>
    fetchApi<LiveMonitor>(root(scope, flagId)),
  metrics: (scope: ReleaseHealthScope, flagId: string) =>
    fetchApi<{ metric: LiveMetric; sourceConnected: boolean }[]>(
      `${root(scope, flagId)}/metrics`
    ).then((items): MonitorMetric[] =>
      items.map(({ metric, sourceConnected }) => ({
        ...metric,
        sourceConnected,
      }))
    ),
  add: (
    scope: ReleaseHealthScope,
    flagId: string,
    write: MonitorBindingWrite
  ) =>
    fetchApi<LiveMonitor>(
      `${root(scope, flagId)}/bindings`,
      body(write, "POST")
    ),
  edit: (
    scope: ReleaseHealthScope,
    flagId: string,
    id: string,
    write: MonitorBindingWrite
  ) =>
    fetchApi<LiveMonitor>(
      `${root(scope, flagId)}/bindings/${id}`,
      body(write, "PUT")
    ),
  toggleBinding: (
    scope: ReleaseHealthScope,
    flagId: string,
    id: string,
    write: MonitorStatusWrite
  ) =>
    fetchApi<LiveMonitor>(
      `${root(scope, flagId)}/bindings/${id}/status`,
      body(write, "PUT")
    ),
  remove: (
    scope: ReleaseHealthScope,
    flagId: string,
    id: string,
    expectedRevision: number
  ) =>
    fetchApi<LiveMonitor>(
      `${root(scope, flagId)}/bindings/${id}?expectedRevision=${expectedRevision}`,
      { method: "DELETE" }
    ),
  toggle: (
    scope: ReleaseHealthScope,
    flagId: string,
    write: MonitorStatusWrite
  ) =>
    fetchApi<LiveMonitor>(`${root(scope, flagId)}/status`, body(write, "PUT")),
}

export function monitorBindingWrite(
  binding: MonitorBinding,
  metricVersionId: string,
  expectedRevision: number
): MonitorBindingWrite {
  return {
    metricId: binding.metricId,
    metricVersionId,
    purpose: binding.purpose,
    expectedRevision,
    rules:
      binding.purpose === "trend"
        ? []
        : binding.rules.map((rule) => ({
            id: rule.id,
            name: rule.name,
            operator: rule.operator,
            threshold: rule.threshold,
            severity: rule.severity,
            lookback: rule.lookback,
            reducer: rule.reducer,
            sustain: rule.sustain,
            recovery: rule.recovery,
            evaluationInterval: rule.evaluationInterval,
            warmup: rule.warmup,
            dataDelay: rule.dataDelay,
            webhookId: rule.webhookId,
          })),
  }
}
