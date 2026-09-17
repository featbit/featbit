import type { TFunction } from "i18next"
import {
  buildMetricUnit,
  rateNumerators,
  ratePeriods,
} from "@/features/release-health/metrics/metric-contract"
import type {
  GuardAlertRule,
  MetricMeasurementKind,
  MetricRateNumerator,
  MetricRatePeriod,
  MetricUnit,
} from "@/features/release-health/release-health-types"

type Profile = {
  id: string
  measurementKind: MetricMeasurementKind
  unitKind: MetricUnit["kind"]
  key: string
  name: string
  semantics: string
  trigger: number
  recovered: number
  threshold: number
  operator: GuardAlertRule["operator"]
  reducer: GuardAlertRule["reducer"]
  minimum: number | null
  maximum: number | null
  fractionDigits: number
}
export const ALERT_PROFILES = [
  {
    id: "gauge-count",
    measurementKind: "gauge",
    unitKind: "count",
    key: "queue_depth",
    name: "Queue depth",
    semantics: "Current number of queued jobs at each sample time.",
    trigger: 125.125,
    recovered: 75.375,
    threshold: 100,
    operator: ">",
    reducer: "latest",
    minimum: null,
    maximum: null,
    fractionDigits: 2,
  },
  {
    id: "gauge-percent",
    measurementKind: "gauge",
    unitKind: "percent",
    key: "cpu_utilization",
    name: "CPU utilization",
    semantics: "CPU utilization returned by the provider on a 0–100 scale.",
    trigger: 91.2345,
    recovered: 72.5678,
    threshold: 85,
    operator: ">=",
    reducer: "maximum",
    minimum: 0,
    maximum: 100,
    fractionDigits: 2,
  },
  {
    id: "gauge-ratio",
    measurementKind: "gauge",
    unitKind: "ratio",
    key: "memory_utilization",
    name: "Memory utilization",
    semantics: "Memory utilization returned by the provider on a 0–1 scale.",
    trigger: 0.92345,
    recovered: 0.72567,
    threshold: 0.85,
    operator: ">",
    reducer: "average",
    minimum: 0,
    maximum: 1,
    fractionDigits: 4,
  },
  {
    id: "gauge-duration",
    measurementKind: "gauge",
    unitKind: "duration",
    key: "api_p95_latency",
    name: "API P95 latency",
    semantics:
      "Provider-computed P95 latency, already converted to canonical milliseconds.",
    trigger: 1250.125,
    recovered: 650.375,
    threshold: 800,
    operator: ">",
    reducer: "average",
    minimum: null,
    maximum: null,
    fractionDigits: 2,
  },
  {
    id: "gauge-data",
    measurementKind: "gauge",
    unitKind: "data",
    key: "memory_usage",
    name: "Memory usage",
    semantics: "Current service memory usage in canonical bytes.",
    trigger: 2147483648,
    recovered: 805306368,
    threshold: 1073741824,
    operator: ">=",
    reducer: "latest",
    minimum: null,
    maximum: 4294967296,
    fractionDigits: 2,
  },
  {
    id: "count-count",
    measurementKind: "count",
    unitKind: "count",
    key: "failed_jobs",
    name: "Failed jobs",
    semantics:
      "Provider-computed failed-job count over its query window; fractional estimates are allowed.",
    trigger: 12.375,
    recovered: 4.125,
    threshold: 10,
    operator: ">",
    reducer: "maximum",
    minimum: 0,
    maximum: null,
    fractionDigits: 2,
  },
  {
    id: "ratio-percent",
    measurementKind: "ratio",
    unitKind: "percent",
    key: "checkout_error_rate",
    name: "Checkout error rate",
    semantics:
      "Percentage of checkout requests with an error in the provider's rolling 30-second window, on a 0–100 scale.",
    trigger: 2.6,
    recovered: 0.8,
    threshold: 2,
    operator: ">",
    reducer: "average",
    minimum: 0,
    maximum: 100,
    fractionDigits: 2,
  },
  {
    id: "ratio-ratio",
    measurementKind: "ratio",
    unitKind: "ratio",
    key: "checkout_completion",
    name: "Checkout completion",
    semantics:
      "Provider-computed completed checkouts divided by attempts, on a 0–1 scale.",
    trigger: 0.95123,
    recovered: 0.99234,
    threshold: 0.98,
    operator: "<",
    reducer: "minimum",
    minimum: 0,
    maximum: 1,
    fractionDigits: 4,
  },
  {
    id: "rate-rate",
    measurementKind: "rate",
    unitKind: "rate",
    key: "service_throughput",
    name: "Service throughput",
    semantics:
      "Provider-computed throughput in the configured numerator and time period; no hidden time conversion.",
    trigger: 72.375,
    recovered: 125.125,
    threshold: 100,
    operator: "<=",
    reducer: "average",
    minimum: null,
    maximum: null,
    fractionDigits: 2,
  },
] as const satisfies readonly Profile[]
export type AlertProfileId = (typeof ALERT_PROFILES)[number]["id"]
export function alertProfileLabel(
  t: TFunction,
  profile: (typeof ALERT_PROFILES)[number]
) {
  return `${t(`releaseHealth.resultContract.measurementKind.${profile.measurementKind}`)} · ${t(`releaseHealth.resultContract.unit.${profile.unitKind}`)}`
}
export type AlertSampleOptions = {
  profileId: AlertProfileId
  rateNumerator: MetricRateNumerator
  ratePeriod: MetricRatePeriod
  severity: GuardAlertRule["severity"]
}
export const DEFAULT_ALERT_SAMPLE: AlertSampleOptions = {
  profileId: "ratio-percent",
  rateNumerator: "requests",
  ratePeriod: "second",
  severity: "critical",
}
export function alertSampleProfile(sample: AlertSampleOptions) {
  const profile = ALERT_PROFILES.find((item) => item.id === sample.profileId)
  if (!profile) throw new Error("Unsupported result profile.")
  return profile
}
export function alertSampleUnit(sample: AlertSampleOptions) {
  return buildMetricUnit({
    unitKind: alertSampleProfile(sample).unitKind,
    rateNumerator: sample.rateNumerator,
    ratePeriod: sample.ratePeriod,
  })
}
// All nine profiles, all 6 × 3 rate units and both rule severities.
export const ALERT_SAMPLE_CASES: AlertSampleOptions[] = ALERT_PROFILES.flatMap(
  (profile) =>
    (["warning", "critical"] as const).flatMap<AlertSampleOptions>(
      (severity) =>
        profile.unitKind === "rate"
          ? rateNumerators.flatMap((rateNumerator) =>
              ratePeriods.map((ratePeriod) => ({
                profileId: profile.id,
                rateNumerator,
                ratePeriod,
                severity,
              }))
            )
          : [{ ...DEFAULT_ALERT_SAMPLE, profileId: profile.id, severity }]
    )
)
export function canonicalUnitLabel(unit: MetricUnit) {
  switch (unit.kind) {
    case "percent":
      return "%"
    case "ratio":
      return "ratio"
    case "duration":
      return "ms"
    case "data":
      return "B"
    case "count":
      return "count"
    case "rate":
      return `${unit.numerator}/${{ second: "s", minute: "min", hour: "h" }[unit.per]}`
  }
}
