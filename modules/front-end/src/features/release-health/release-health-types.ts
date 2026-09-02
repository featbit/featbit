export type ReleaseMetricCategory = "impact" | "quality" | "reliability"

export type MetricMeasurementKind = "gauge" | "count" | "ratio" | "rate"

export type MetricRateNumerator =
  "events" | "requests" | "errors" | "operations" | "items" | "bytes"

export type MetricRatePeriod = "second" | "minute" | "hour"

export type MetricUnit =
  | { kind: "count" }
  | { kind: "percent"; scale: "zero_to_one_hundred" }
  | { kind: "ratio"; scale: "zero_to_one" }
  | { kind: "duration"; base: "millisecond" }
  | { kind: "data"; base: "byte" }
  | {
      kind: "rate"
      numerator: MetricRateNumerator
      per: MetricRatePeriod
    }

export type MetricResultContract = {
  schemaVersion: 1
  resultKind: "numeric_time_series"
  cardinality: "single"
  measurementKind: MetricMeasurementKind
  unit: MetricUnit
  constraints: {
    minimum?: number
    maximum?: number
    allowNaN: false
    allowInfinity: false
  }
}

export type MetricObservationMode = "environment"

export type MetricSourceProviderType = "prometheus-compatible"

export type MetricSourceConnectionStatus =
  "not-tested" | "connected" | "unavailable" | "disabled"

export type MetricSourceAuthenticationType = "none" | "bearer_token" | "basic"

export type MetricSourceAuthentication =
  | {
      type: "none"
      secretState: "not_configured"
    }
  | {
      type: "bearer_token"
      secretState: "configured" | "revoked"
      lastRotatedAt?: string
    }
  | {
      type: "basic"
      username: string
      secretState: "configured" | "revoked"
      lastRotatedAt?: string
    }

export type MetricSourceConnection = {
  /** Optimistic concurrency token for persisted connections; independent of semantic revision. */
  backendVersion?: number
  id: string
  environmentKey: string
  providerType: MetricSourceProviderType
  name: string
  endpoint: string
  authentication: MetricSourceAuthentication
  revision: number
  status: MetricSourceConnectionStatus
  lastCheckedAt: string
  usedByBindings: number
}

export type MetricSourceBinding = {
  providerType: MetricSourceProviderType
  connectionId: string
  connectionName: string
  bindingRevision: number
  query: string
  queryMode: "range"
  step: "1m" | "5m" | "15m"
  syncInterval: "1m" | "5m"
}

export type DataStatus = "collecting" | "ready" | "no-data" | "stale" | "error"

export type HealthStatus = "healthy" | "warning" | "critical" | "not-evaluated"

export type GateStatus =
  "waiting" | "passing" | "breached" | "approval-required"

export type MonitorPurpose = "observe" | "guard"

export type MetricPoint = {
  timestamp: string
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
  sourceBinding?: MetricSourceBinding
}

export type ReleaseMetric = {
  id: string
  key: string
  name: string
  description: string
  category?: ReleaseMetricCategory
  resultSemantics: string
  resultContract: MetricResultContract
  fractionDigits: number
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
