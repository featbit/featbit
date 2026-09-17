import type {
  HealthMonitor,
  MetricPoint,
  MetricSourceConnection,
  ReleaseMetric,
} from "./release-health-types"

function points(values: number[], startHour = 9): MetricPoint[] {
  return values.map((value, index) => {
    const minute = index * 5
    const hour = startHour + Math.floor(minute / 60)
    const minutes = String(minute % 60).padStart(2, "0")
    return {
      timestamp: `2026-08-28T${String(hour).padStart(2, "0")}:${minutes}:00+08:00`,
      value,
    }
  })
}

export const metricSourceConnections: MetricSourceConnection[] = [
  {
    id: "connection-production-metrics",
    environmentKey: "production",
    providerType: "prometheus-compatible",
    name: "Production metrics",
    endpoint: "https://prometheus.prod.example.com",
    authentication: {
      type: "bearer_token",
      secretState: "configured",
      lastRotatedAt: "3 days ago",
    },
    revision: 3,
    status: "connected",
    lastCheckedAt: "2 min ago",
    usedByBindings: 4,
  },
  {
    id: "connection-shared-gateway",
    environmentKey: "production",
    providerType: "prometheus-compatible",
    name: "Shared metrics gateway",
    endpoint: "https://metrics-gateway.example.com/prometheus",
    authentication: {
      type: "basic",
      username: "metrics-reader",
      secretState: "configured",
      lastRotatedAt: "18 days ago",
    },
    revision: 1,
    status: "unavailable",
    lastCheckedAt: "18 min ago",
    usedByBindings: 0,
  },
]

export const releaseMetrics: ReleaseMetric[] = [
  {
    id: "metric-error-rate",
    key: "checkout_error_rate",
    name: "Checkout error rate",
    description: "Failed checkout requests divided by all checkout requests.",
    category: "quality",
    resultSemantics:
      "Each point is the percentage of checkout requests that returned an error during the provider query window.",
    resultContract: {
      schemaVersion: 1,
      resultKind: "numeric_time_series",
      cardinality: "single",
      measurementKind: "ratio",
      unit: { kind: "percent", scale: "zero_to_one_hundred" },
      constraints: {
        minimum: 0,
        maximum: 100,
        allowNaN: false,
        allowInfinity: false,
      },
    },
    fractionDigits: 2,
    version: 3,
    usedByMonitors: 3,
    usedByFlags: ["checkout-redesign", "payment-routing"],
    environment: {
      dataStatus: "ready",
      value: 2.7,
      displayValue: "2.7%",
      changeLabel: "+1.1 pp in 30 min",
      updatedAt: "35 sec ago",
      coverage: 99.4,
      sourceBinding: {
        providerType: "prometheus-compatible",
        connectionId: "connection-production-metrics",
        connectionName: "Production metrics",
        bindingRevision: 4,
        query:
          '100 * sum(rate(http_requests_total{service="checkout",status=~"5.."}[5m])) / sum(rate(http_requests_total{service="checkout"}[5m]))',
        queryMode: "range",
        step: "1m",
        syncInterval: "1m",
      },
      history: points([
        0.9, 1.1, 1, 1.2, 1.1, 1.3, 1.4, 1.5, 1.6, 1.8, 2.1, 2.4, 2.6, 2.8, 2.7,
        2.9, 2.7,
      ]),
    },
  },
  {
    id: "metric-api-latency",
    key: "api_p95_latency",
    name: "API P95 latency",
    description: "95th percentile latency across the checkout API service.",
    category: "reliability",
    resultSemantics:
      "Each point is the P95 checkout API request duration calculated by Prometheus and returned in milliseconds.",
    resultContract: {
      schemaVersion: 1,
      resultKind: "numeric_time_series",
      cardinality: "single",
      measurementKind: "gauge",
      unit: { kind: "duration", base: "millisecond" },
      constraints: {
        minimum: 0,
        allowNaN: false,
        allowInfinity: false,
      },
    },
    fractionDigits: 0,
    version: 5,
    usedByMonitors: 6,
    usedByFlags: ["checkout-redesign", "payment-routing", "recommendations-v2"],
    environment: {
      dataStatus: "ready",
      value: 842,
      displayValue: "842 ms",
      changeLabel: "+18% in 30 min",
      updatedAt: "42 sec ago",
      coverage: 98.8,
      sourceBinding: {
        providerType: "prometheus-compatible",
        connectionId: "connection-production-metrics",
        connectionName: "Production metrics",
        bindingRevision: 6,
        query:
          "1000 * histogram_quantile(0.95, sum(rate(http_server_duration_bucket[5m])) by (le))",
        queryMode: "range",
        step: "1m",
        syncInterval: "1m",
      },
      history: points([
        610, 625, 604, 632, 650, 671, 688, 721, 760, 790, 815, 832, 847, 861,
        852, 848, 842,
      ]),
    },
  },
  {
    id: "metric-completion",
    key: "checkout_completion_rate",
    name: "Checkout completion",
    description: "Sessions that complete checkout after entering the flow.",
    category: "impact",
    resultSemantics:
      "Each point is the percentage of checkout sessions completed during the provider query window.",
    resultContract: {
      schemaVersion: 1,
      resultKind: "numeric_time_series",
      cardinality: "single",
      measurementKind: "ratio",
      unit: { kind: "percent", scale: "zero_to_one_hundred" },
      constraints: {
        minimum: 0,
        maximum: 100,
        allowNaN: false,
        allowInfinity: false,
      },
    },
    fractionDigits: 1,
    version: 2,
    usedByMonitors: 2,
    usedByFlags: ["checkout-redesign"],
    environment: {
      dataStatus: "ready",
      value: 68.4,
      displayValue: "68.4%",
      changeLabel: "-0.8 pp in 30 min",
      updatedAt: "1 min ago",
      coverage: 96.7,
      sourceBinding: {
        providerType: "prometheus-compatible",
        connectionId: "connection-production-metrics",
        connectionName: "Production metrics",
        bindingRevision: 3,
        query:
          "100 * sum(increase(checkout_completed_total[5m])) / sum(increase(checkout_started_total[5m]))",
        queryMode: "range",
        step: "5m",
        syncInterval: "5m",
      },
      history: points([
        70.1, 70.4, 70.2, 69.9, 70, 69.8, 69.5, 69.3, 69.1, 68.9, 69, 68.8,
        68.6, 68.5, 68.7, 68.5, 68.4,
      ]),
    },
  },
  {
    id: "metric-memory",
    key: "service_memory_saturation",
    name: "Service memory saturation",
    description:
      "Memory working-set saturation for services in this environment.",
    category: "reliability",
    resultSemantics:
      "Each point is the maximum service memory working-set saturation returned as a percentage.",
    resultContract: {
      schemaVersion: 1,
      resultKind: "numeric_time_series",
      cardinality: "single",
      measurementKind: "gauge",
      unit: { kind: "percent", scale: "zero_to_one_hundred" },
      constraints: {
        minimum: 0,
        maximum: 100,
        allowNaN: false,
        allowInfinity: false,
      },
    },
    fractionDigits: 0,
    version: 1,
    usedByMonitors: 4,
    usedByFlags: ["checkout-redesign", "search-ranking-v3"],
    environment: {
      dataStatus: "stale",
      value: 76,
      displayValue: "76%",
      changeLabel: "last complete window",
      updatedAt: "12 min ago",
      coverage: 61.2,
      sourceBinding: {
        providerType: "prometheus-compatible",
        connectionId: "connection-production-metrics",
        connectionName: "Production metrics",
        bindingRevision: 2,
        query:
          "100 * max(process_memory_working_set_bytes / container_memory_limit_bytes)",
        queryMode: "range",
        step: "5m",
        syncInterval: "5m",
      },
      history: points([
        62, 63, 61, 64, 66, 68, 70, 72, 73, 74, 75, 76, 76, 76, 76, 76, 76,
      ]),
    },
  },
  {
    id: "metric-crash-free",
    key: "crash_free_sessions",
    name: "Crash-free sessions",
    description: "Percentage of application sessions without a crash signal.",
    category: "quality",
    resultSemantics:
      "Each point is the percentage of application sessions without a crash during the provider query window.",
    resultContract: {
      schemaVersion: 1,
      resultKind: "numeric_time_series",
      cardinality: "single",
      measurementKind: "ratio",
      unit: { kind: "percent", scale: "zero_to_one_hundred" },
      constraints: {
        minimum: 0,
        maximum: 100,
        allowNaN: false,
        allowInfinity: false,
      },
    },
    fractionDigits: 2,
    version: 1,
    usedByMonitors: 1,
    usedByFlags: ["mobile-navigation"],
    environment: {
      dataStatus: "collecting",
      value: null,
      displayValue: "—",
      changeLabel: "warm-up in progress",
      updatedAt: "receiving events",
      coverage: 38.5,
      sourceBinding: {
        providerType: "prometheus-compatible",
        connectionId: "connection-production-metrics",
        connectionName: "Production metrics",
        bindingRevision: 1,
        query:
          "100 * (1 - sum(increase(app_crash_total[5m])) / sum(increase(app_session_total[5m])))",
        queryMode: "range",
        step: "5m",
        syncInterval: "5m",
      },
      history: points([99.8, 99.7, 99.8, 99.7, 99.6, 99.7]),
    },
  },
]

export const checkoutMonitor: HealthMonitor = {
  id: "monitor-checkout-safety",
  name: "Checkout safety monitor",
  flagKey: "checkout-redesign",
  enabled: true,
  bindings: [
    {
      metricId: "metric-error-rate",
      observationMode: "environment",
      enabled: true,
      purpose: "guard",
      rules: [
        {
          id: "error-rate-critical",
          name: "Error rate critical",
          webhookId: null,
          operator: ">",
          threshold: 2,
          severity: "critical",
          lookback: 10,
          reducer: "average",
          sustain: 5,
          recovery: 5,
          evaluationInterval: 1,
          warmup: 0,
          dataDelay: 0,
          latestCheck: {
            healthStatus: "critical",
            dataStatus: "ready",
            value: 2.6,
            checkedAt: "2026-09-16T02:07:00Z",
          },
        },
      ],
    },
    {
      metricId: "metric-api-latency",
      observationMode: "environment",
      enabled: true,
      purpose: "guard",
      rules: [
        {
          id: "latency-critical",
          name: "Latency critical",
          webhookId: null,
          operator: ">",
          threshold: 800,
          severity: "critical",
          lookback: 10,
          reducer: "average",
          sustain: 10,
          recovery: 5,
          evaluationInterval: 1,
          warmup: 0,
          dataDelay: 0,
          latestCheck: {
            healthStatus: "critical",
            dataStatus: "ready",
            value: 940,
            checkedAt: "2026-09-16T02:07:00Z",
          },
        },
      ],
    },
    {
      metricId: "metric-completion",
      observationMode: "environment",
      enabled: true,
      purpose: "trend",
    },
    {
      metricId: "metric-memory",
      observationMode: "environment",
      enabled: true,
      purpose: "guard",
      rules: [
        {
          id: "memory-critical",
          name: "Memory critical",
          webhookId: null,
          operator: ">",
          threshold: 85,
          severity: "critical",
          lookback: 10,
          reducer: "average",
          sustain: 10,
          recovery: 5,
          evaluationInterval: 1,
          warmup: 0,
          dataDelay: 0,
          latestCheck: {
            healthStatus: "not-evaluated",
            dataStatus: "stale",
            value: null,
            checkedAt: "2026-09-16T02:07:00Z",
          },
        },
      ],
    },
  ],
  updatedAt: "2026-08-27T15:24:00+08:00",
}

export function metricById(metricId: string) {
  return releaseMetrics.find((metric) => metric.id === metricId)
}

export function metricByKey(metricKey: string) {
  return releaseMetrics.find((metric) => metric.key === metricKey)
}
