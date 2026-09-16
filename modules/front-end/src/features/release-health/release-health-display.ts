import type { TFunction } from "i18next"
import type { ReleaseMetric } from "./release-health-types"

type MetricField = "name" | "description" | "changeLabel" | "updatedAt"

export function metricSampleText(
  t: TFunction,
  metric: ReleaseMetric,
  field: MetricField
) {
  const fallback =
    field === "changeLabel" || field === "updatedAt"
      ? metric.environment[field]
      : metric[field]

  return t(`releaseHealth.samples.metrics.${metric.key}.${field}`, {
    defaultValue: fallback,
  })
}

export function ruleSampleText(t: TFunction, rule: string) {
  if (rule === "Observe trend") return t("releaseHealth.monitor.trendOnly")

  const duration = rule.match(/^(.+?) for (\d+) min$/)
  if (duration) {
    return t("releaseHealth.samples.ruleForMinutes", {
      condition: duration[1],
      count: Number(duration[2]),
    })
  }

  return rule
}

export function monitorSampleText(t: TFunction, monitor: string) {
  const keys: Record<string, string> = {
    "Checkout safety monitor": "checkoutSafety",
    "Payment reliability": "paymentReliability",
    "Recommendations observation": "recommendationsObservation",
    "Checkout conversion guard": "checkoutConversionGuard",
    "Checkout resource watch": "checkoutResourceWatch",
    "Search resource watch": "searchResourceWatch",
    "Mobile stability guard": "mobileStabilityGuard",
  }
  const key = keys[monitor]
  return key
    ? t(`releaseHealth.samples.monitors.${key}`, { defaultValue: monitor })
    : monitor
}
