export type MetricStatus = "active" | "archived"

export type MetricType = "binary" | "numeric"

export type MetricAggregation = "once" | "count" | "sum" | "average"

export type MetricRole = "primary" | "guardrail"

export type MetricRun = {
  id: string
  key: string
  status: string
  role: MetricRole
}

export type MetricExperimentUsage = {
  experimentId: string
  experimentName: string
  runs: MetricRun[]
}

export type Metric = {
  id: string
  featBitEnvId: string
  name: string
  key: string
  description?: string | null
  metricType: MetricType | string
  metricAgg: MetricAggregation | string
  status: MetricStatus
  createdAt: string
  updatedAt: string
  experimentUsage?: MetricExperimentUsage[]
}

export type PagedMetrics = {
  items: Metric[]
  totalCount: number
}

export type MetricCreatePayload = {
  name: string
  key: string
  description: string | null
  metricType: MetricType
  metricAgg: MetricAggregation
}

export type MetricUpdatePayload = Pick<
  MetricCreatePayload,
  "name" | "description" | "metricType" | "metricAgg"
>
