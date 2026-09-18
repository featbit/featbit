import type { Metric } from "@/features/expt-metrics/metrics-types"
import type {
  GuardrailMetricConfig,
  PrimaryMetricConfig,
} from "../metric-config-types"

export type MetricDirection = "increase_good" | "decrease_good"
export type GuardrailDirection = "increase_bad" | "decrease_bad"

export type SelectedMetric = {
  id: string
  key: string
  name: string
  metricType: string
  metricAgg: string
  direction: MetricDirection | GuardrailDirection
}

function selectedMetric(
  value: PrimaryMetricConfig | GuardrailMetricConfig,
  direction: MetricDirection | GuardrailDirection
): SelectedMetric {
  return {
    id: value.metricId,
    key: value.metricKey,
    name: value.name,
    metricType: value.metricType,
    metricAgg: value.metricAgg,
    direction,
  }
}

export function parsePrimaryMetric(
  value: PrimaryMetricConfig | null | undefined
) {
  return value ? selectedMetric(value, value.expectedDirection) : null
}

export function parseGuardrailMetrics(
  value: GuardrailMetricConfig[] | null | undefined
) {
  return value?.map((item) => selectedMetric(item, item.direction)) ?? []
}

export function metricTypeLabelKey(metric: Pick<Metric, "metricType">) {
  return metric.metricType === "numeric" ? "numeric" : "binary"
}

export function metricAggregationLabelKey(
  metric: Pick<Metric, "metricType" | "metricAgg">
) {
  return metric.metricType === "numeric" ? metric.metricAgg : "once"
}
