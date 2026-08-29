export type ReleaseMetricCategory = "impact" | "quality" | "reliability"

export type ReleaseMetricSignalType =
  "counter" | "gauge" | "rate" | "distribution"

export type MetricObservationScope = "flag-contextual" | "environment"

export type DataStatus = "collecting" | "ready" | "no-data" | "stale" | "error"

export type HealthStatus = "healthy" | "warning" | "critical" | "not-evaluated"

export type GateStatus =
  "waiting" | "passing" | "breached" | "approval-required"

export type MonitorPurpose = "observe" | "guard"

export type MetricPoint = {
  time: string
  label: string
  value: number
}

export type EnvironmentMetricState = {
  dataStatus: DataStatus
  value: number | null
  displayValue: string
  changeLabel: string
  updatedAt: string
  coverage: number
  history: MetricPoint[]
}

export type ReleaseMetric = {
  id: string
  key: string
  name: string
  description: string
  category: ReleaseMetricCategory
  signalType: ReleaseMetricSignalType
  observationScope: MetricObservationScope
  source: string
  sourceEvent: string
  aggregation: string
  unit: string
  version: number
  usedByMonitors: number
  usedByFlags: string[]
  environment: EnvironmentMetricState
}

export type MonitorBinding = {
  metricId: string
  purpose: MonitorPurpose
  rule: string
  noDataPolicy: "wait" | "notify" | "block"
  healthStatus: HealthStatus
  gateBlocking: boolean
}

export type HealthMonitor = {
  id: string
  name: string
  flagKey: string
  enabled: boolean
  mode: "continuous" | "change-window"
  triggers: Array<"manual" | "flag-change" | "schedule" | "api">
  bindings: MonitorBinding[]
  warmup: string
  lookback: string
  evaluationInterval: string
  sustain: string
  actions: string[]
  updatedAt: string
}

export type HealthAssessment = {
  metricId: string
  purpose: MonitorPurpose
  dataStatus: DataStatus
  healthStatus: HealthStatus
  observedValue: string
  rule: string
  reason: string
  evidenceWindow: string
  gateBlocking: boolean
}

export type HealthSessionEvent = {
  id: string
  occurredAt: string
  kind: "session" | "assessment" | "alert" | "action" | "audit"
  title: string
  description: string
  result?: "success" | "warning" | "pending"
}

export type HealthSession = {
  id: string
  displayId: string
  monitorId: string
  monitorName: string
  flagKey: string
  flagName: string
  trigger: "manual" | "flag-change" | "schedule" | "api"
  triggerLabel: string
  status: "active" | "completed" | "stopped"
  gateStatus: GateStatus
  dataStatus: DataStatus
  startedAt: string
  endedAt?: string
  revisionBefore: string
  revisionAfter: string
  changeSummary: string
  sourceReference?: string
  assessments: HealthAssessment[]
  events: HealthSessionEvent[]
  snapshot: {
    createdAt: string
    metricVersions: string[]
    warmup: string
    lookback: string
    evaluationInterval: string
    sustain: string
    noDataPolicy: string
    actions: string[]
  }
}
