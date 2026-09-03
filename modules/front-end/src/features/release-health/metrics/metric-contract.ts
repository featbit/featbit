import type { TFunction } from "i18next"
import type {
  MetricMeasurementKind,
  MetricRateNumerator,
  MetricRatePeriod,
  MetricResultContract,
  MetricUnit,
  ReleaseMetric,
} from "../release-health-types"

export type MetricUnitKind = MetricUnit["kind"]

export const measurementKinds = ["gauge", "count", "ratio", "rate"] as const

export const unitKindsByMeasurementKind: Record<
  MetricMeasurementKind,
  readonly MetricUnitKind[]
> = {
  gauge: ["count", "percent", "ratio", "duration", "data"],
  count: ["count"],
  ratio: ["percent", "ratio"],
  rate: ["rate"],
}

export const rateNumerators = [
  "events",
  "requests",
  "errors",
  "operations",
  "items",
  "bytes",
] as const satisfies readonly MetricRateNumerator[]

export const ratePeriods = [
  "second",
  "minute",
  "hour",
] as const satisfies readonly MetricRatePeriod[]

export function defaultUnitKindForMeasurementKind(
  measurementKind: MetricMeasurementKind
) {
  return unitKindsByMeasurementKind[measurementKind][0]
}

export function isMetricResultProfileValid({
  measurementKind,
  unitKind,
}: {
  measurementKind: MetricMeasurementKind
  unitKind: MetricUnitKind
}) {
  return unitKindsByMeasurementKind[measurementKind].includes(unitKind)
}

export function buildMetricUnit({
  unitKind,
  rateNumerator,
  ratePeriod,
}: {
  unitKind: MetricUnitKind
  rateNumerator: MetricRateNumerator
  ratePeriod: MetricRatePeriod
}): MetricUnit {
  switch (unitKind) {
    case "count":
      return { kind: "count" }
    case "percent":
      return { kind: "percent", scale: "zero_to_one_hundred" }
    case "ratio":
      return { kind: "ratio", scale: "zero_to_one" }
    case "duration":
      return { kind: "duration", base: "millisecond" }
    case "data":
      return { kind: "data", base: "byte" }
    case "rate":
      return {
        kind: "rate",
        numerator: rateNumerator,
        per: ratePeriod,
      }
  }
}

export function resultContract({
  measurementKind,
  unit,
  minimum,
  maximum,
}: {
  measurementKind: MetricMeasurementKind
  unit: MetricUnit
  minimum?: number
  maximum?: number
}): MetricResultContract {
  return {
    schemaVersion: 1,
    resultKind: "numeric_time_series",
    cardinality: "single",
    measurementKind,
    unit,
    constraints: {
      minimum,
      maximum,
      allowNaN: false,
      allowInfinity: false,
    },
  }
}

export function metricUnitLabel(t: TFunction, unit: MetricUnit) {
  if (unit.kind === "rate") {
    return t("releaseHealth.resultContract.rateUnit", {
      numerator: t(
        `releaseHealth.resultContract.rateNumerator.${unit.numerator}`
      ),
      period: t(`releaseHealth.resultContract.ratePeriod.${unit.per}`),
    })
  }

  return t(`releaseHealth.resultContract.unit.${unit.kind}`)
}

export function metricResultProfileLabel(
  t: TFunction,
  metric: { resultContract: MetricResultContract }
) {
  return `${t(
    `releaseHealth.resultContract.measurementKind.${metric.resultContract.measurementKind}`
  )} · ${metricUnitLabel(t, metric.resultContract.unit)}`
}

export function formatMetricValue(metric: ReleaseMetric, value: number) {
  const unit = metric.resultContract.unit
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: metric.fractionDigits,
  }).format(value)

  switch (unit.kind) {
    case "percent":
      return `${formatted}%`
    case "ratio":
    case "count":
      return formatted
    case "duration":
      return value >= 1000
        ? `${new Intl.NumberFormat(undefined, {
            maximumFractionDigits: metric.fractionDigits,
          }).format(value / 1000)} s`
        : `${formatted} ms`
    case "data":
      return formatBytes(value, metric.fractionDigits)
    case "rate":
      return `${formatted} ${unit.numerator}/${shortPeriod(unit.per)}`
  }
}

export function resultContractRange(unit: MetricUnit) {
  if (unit.kind === "percent") return { minimum: 0, maximum: 100 }
  if (unit.kind === "ratio") return { minimum: 0, maximum: 1 }
  return { minimum: 0, maximum: undefined }
}

function shortPeriod(period: MetricRatePeriod) {
  if (period === "second") return "s"
  if (period === "minute") return "min"
  return "h"
}

function formatBytes(value: number, fractionDigits: number) {
  const units = ["B", "KiB", "MiB", "GiB"]
  let scaled = value
  let index = 0
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024
    index += 1
  }
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: fractionDigits,
  }).format(scaled)} ${units[index]}`
}
