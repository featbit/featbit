type MetricConfig = {
  metricId: string
  metricKey: string
  name: string
  eventName: string
  description?: string | null
  metricType: string
  metricAgg: string
}

export type PrimaryMetricConfig = MetricConfig & {
  expectedDirection: "increase_good" | "decrease_good"
}

export type GuardrailMetricConfig = MetricConfig & {
  direction: "increase_bad" | "decrease_bad"
}
