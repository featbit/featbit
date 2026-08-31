export type ReleaseMetricCategory = "impact" | "quality" | "reliability"

export type ReleaseMetricValueType =
  "count" | "gauge" | "rate" | "ratio" | "distribution"

export type ReleaseMetricCalculation =
  | "sum"
  | "latest"
  | "average"
  | "minimum"
  | "maximum"
  | "per-second"
  | "per-minute"
  | "per-hour"
  | "numerator-over-denominator"
  | "one-minus-ratio"
  | "p50"
  | "p90"
  | "p95"
  | "p99"

export type ReleaseMetricUnit =
  | "count"
  | "percent"
  | "ratio"
  | "milliseconds"
  | "seconds"
  | "bytes"
  | "megabytes"
  | "events-per-second"
  | "events-per-minute"
  | "events-per-hour"
  | "requests-per-second"
  | "errors-per-minute"

export type MetricObservationMode = "flag-contextual" | "environment"

export type MetricContextCapability =
  "flag-key" | "flag-revision" | "variation" | "exposure"

export type MetricSourceType = "featbit-events" | "prometheus"

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
  sourceBinding?: {
    sourceType: MetricSourceType
    sourceLabel: string
    selector: string
    connectionName?: string
    bindingRevision: number
    contextCapabilities: MetricContextCapability[]
  }
}

export type ReleaseMetric = {
  id: string
  key: string
  name: string
  description: string
  category: ReleaseMetricCategory
  valueType: ReleaseMetricValueType
  calculation: ReleaseMetricCalculation
  unit: ReleaseMetricUnit
  version: number
  usedByMonitors: number
  usedByFlags: string[]
  environment: EnvironmentMetricState
}

export type MonitorBinding = {
  metricId: string
  observationMode: MetricObservationMode
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
  observationMode: MetricObservationMode
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
