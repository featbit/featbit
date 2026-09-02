import { describe, expect, it } from "vitest"
import {
  buildMetricUnit,
  defaultUnitKindForMeasurementKind,
  isMetricResultProfileValid,
  resultContract,
  resultContractRange,
  unitKindsByMeasurementKind,
} from "./metric-contract"

describe("release metric result contract", () => {
  it("exposes only the nine MVP result profiles", () => {
    expect(unitKindsByMeasurementKind).toEqual({
      gauge: ["count", "percent", "ratio", "duration", "data"],
      count: ["count"],
      ratio: ["percent", "ratio"],
      rate: ["rate"],
    })
  })

  it("rejects incompatible measurement kind and unit pairs", () => {
    expect(
      isMetricResultProfileValid({
        measurementKind: "count",
        unitKind: "percent",
      })
    ).toBe(false)
    expect(
      isMetricResultProfileValid({
        measurementKind: "ratio",
        unitKind: "duration",
      })
    ).toBe(false)
    expect(
      isMetricResultProfileValid({
        measurementKind: "gauge",
        unitKind: "duration",
      })
    ).toBe(true)
  })

  it("builds a structured rate unit", () => {
    expect(
      buildMetricUnit({
        unitKind: "rate",
        rateNumerator: "requests",
        ratePeriod: "second",
      })
    ).toEqual({
      kind: "rate",
      numerator: "requests",
      per: "second",
    })
  })

  it("creates a fixed single-series numeric contract", () => {
    expect(
      resultContract({
        measurementKind: "ratio",
        unit: { kind: "percent", scale: "zero_to_one_hundred" },
        minimum: 0,
        maximum: 100,
      })
    ).toMatchObject({
      schemaVersion: 1,
      resultKind: "numeric_time_series",
      cardinality: "single",
      measurementKind: "ratio",
      constraints: {
        minimum: 0,
        maximum: 100,
        allowNaN: false,
        allowInfinity: false,
      },
    })
  })

  it("uses canonical built-in ranges and compatible defaults", () => {
    expect(
      resultContractRange({
        kind: "percent",
        scale: "zero_to_one_hundred",
      })
    ).toEqual({ minimum: 0, maximum: 100 })
    expect(defaultUnitKindForMeasurementKind("rate")).toBe("rate")
  })
})
