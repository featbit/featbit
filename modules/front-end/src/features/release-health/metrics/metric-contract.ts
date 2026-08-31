import type {
  MetricContextCapability,
  ReleaseMetricCalculation,
  ReleaseMetricCategory,
  ReleaseMetricUnit,
  ReleaseMetricValueType,
} from "../release-health-types"

export type MetricTemplateId =
  | "conversion-rate"
  | "adoption-rate"
  | "completed-orders"
  | "task-failure-rate"
  | "crash-free-sessions"
  | "page-load-p95"
  | "error-rate"
  | "latency-p95"
  | "availability"
  | "resource-utilization"

export type MetricTemplateChoice = MetricTemplateId | "custom"

export type MetricValueContract = {
  valueType: ReleaseMetricValueType
  calculation: ReleaseMetricCalculation
  unit: ReleaseMetricUnit
}

export const metricTemplates: Record<
  MetricTemplateId,
  MetricValueContract & { category: ReleaseMetricCategory }
> = {
  "conversion-rate": {
    category: "impact",
    valueType: "ratio",
    calculation: "numerator-over-denominator",
    unit: "percent",
  },
  "adoption-rate": {
    category: "impact",
    valueType: "ratio",
    calculation: "numerator-over-denominator",
    unit: "percent",
  },
  "completed-orders": {
    category: "impact",
    valueType: "count",
    calculation: "sum",
    unit: "count",
  },
  "task-failure-rate": {
    category: "quality",
    valueType: "ratio",
    calculation: "numerator-over-denominator",
    unit: "percent",
  },
  "crash-free-sessions": {
    category: "quality",
    valueType: "ratio",
    calculation: "one-minus-ratio",
    unit: "percent",
  },
  "page-load-p95": {
    category: "quality",
    valueType: "distribution",
    calculation: "p95",
    unit: "milliseconds",
  },
  "error-rate": {
    category: "reliability",
    valueType: "ratio",
    calculation: "numerator-over-denominator",
    unit: "percent",
  },
  "latency-p95": {
    category: "reliability",
    valueType: "distribution",
    calculation: "p95",
    unit: "milliseconds",
  },
  availability: {
    category: "reliability",
    valueType: "ratio",
    calculation: "numerator-over-denominator",
    unit: "percent",
  },
  "resource-utilization": {
    category: "reliability",
    valueType: "gauge",
    calculation: "average",
    unit: "percent",
  },
}

export const metricTemplatesByCategory: Record<
  ReleaseMetricCategory,
  MetricTemplateId[]
> = {
  impact: ["conversion-rate", "adoption-rate", "completed-orders"],
  quality: ["task-failure-rate", "crash-free-sessions", "page-load-p95"],
  reliability: [
    "error-rate",
    "latency-p95",
    "availability",
    "resource-utilization",
  ],
}

export const calculationsByValueType: Record<
  ReleaseMetricValueType,
  ReleaseMetricCalculation[]
> = {
  count: ["sum"],
  gauge: ["latest", "average", "minimum", "maximum"],
  rate: ["per-second", "per-minute", "per-hour"],
  ratio: ["numerator-over-denominator", "one-minus-ratio"],
  distribution: ["p50", "p90", "p95", "p99"],
}

export const unitsByValueType: Record<
  ReleaseMetricValueType,
  ReleaseMetricUnit[]
> = {
  count: ["count"],
  gauge: ["count", "percent", "milliseconds", "seconds", "bytes", "megabytes"],
  rate: [
    "events-per-second",
    "requests-per-second",
    "events-per-minute",
    "errors-per-minute",
    "events-per-hour",
  ],
  ratio: ["percent", "ratio"],
  distribution: ["milliseconds", "seconds", "bytes", "megabytes"],
}

const rateUnitsByCalculation: Partial<
  Record<ReleaseMetricCalculation, ReleaseMetricUnit[]>
> = {
  "per-second": ["events-per-second", "requests-per-second"],
  "per-minute": ["events-per-minute", "errors-per-minute"],
  "per-hour": ["events-per-hour"],
}

export function unitsForMetricContract(
  valueType: ReleaseMetricValueType,
  calculation: ReleaseMetricCalculation
) {
  return rateUnitsByCalculation[calculation] ?? unitsByValueType[valueType]
}

export function defaultContractForValueType(
  valueType: ReleaseMetricValueType
): MetricValueContract {
  return {
    valueType,
    calculation: calculationsByValueType[valueType][0],
    unit: unitsForMetricContract(
      valueType,
      calculationsByValueType[valueType][0]
    )[0],
  }
}

export function isMetricValueContractValid({
  valueType,
  calculation,
  unit,
}: MetricValueContract) {
  return (
    calculationsByValueType[valueType].includes(calculation) &&
    unitsForMetricContract(valueType, calculation).includes(unit)
  )
}

export function supportsFlagContext(capabilities: MetricContextCapability[]) {
  return capabilities.includes("flag-key")
}
