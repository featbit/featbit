import type { Metric } from "@/features/expt-metrics/metrics-types"

export type MetricDirection = "increase_good" | "decrease_good"
export type GuardrailDirection = "increase_bad" | "decrease_bad"

export type SelectedMetric = {
  id?: string
  key: string
  name: string
  metricType: string
  metricAgg: string
  direction: MetricDirection | GuardrailDirection
}

function parseJson(value: string | null | undefined): unknown {
  if (!value?.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function selectedMetric(
  value: unknown,
  fallbackDirection: MetricDirection | GuardrailDirection
): SelectedMetric | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const key =
    stringValue(item.metricKey) ||
    stringValue(item.key) ||
    stringValue(item.event)
  if (!key) return null
  const direction = stringValue(item.expectedDirection || item.direction)
  return {
    id: stringValue(item.metricId || item.id) || undefined,
    key,
    name: stringValue(item.name || item.metricName) || key,
    metricType: stringValue(item.metricType) || "binary",
    metricAgg: stringValue(item.metricAgg) || "once",
    direction:
      direction === "decrease_good" || direction === "decrease_bad"
        ? direction
        : fallbackDirection,
  }
}

export function parsePrimaryMetric(value: string | null | undefined) {
  return selectedMetric(parseJson(value), "increase_good")
}

export function parseGuardrails(value: string | null | undefined) {
  const parsed = parseJson(value)
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item) => selectedMetric(item, "increase_bad"))
    .filter((item): item is SelectedMetric => Boolean(item))
}

export function metricTypeLabelKey(metric: Pick<Metric, "metricType">) {
  return metric.metricType === "numeric" ? "numeric" : "binary"
}

export function metricAggregationLabelKey(
  metric: Pick<Metric, "metricType" | "metricAgg">
) {
  return metric.metricType === "numeric" ? metric.metricAgg : "once"
}
