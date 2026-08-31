import { describe, expect, it } from "vitest"
import {
  isMetricValueContractValid,
  metricTemplates,
  metricTemplatesByCategory,
  supportsFlagContext,
} from "./metric-contract"

describe("release metric value contracts", () => {
  it("keeps every recommended template inside the hard compatibility matrix", () => {
    Object.values(metricTemplates).forEach((template) => {
      expect(isMetricValueContractValid(template)).toBe(true)
    })
  })

  it("rejects incompatible value type, calculation, and unit tuples", () => {
    expect(
      isMetricValueContractValid({
        valueType: "count",
        calculation: "sum",
        unit: "percent",
      })
    ).toBe(false)
    expect(
      isMetricValueContractValid({
        valueType: "ratio",
        calculation: "p95",
        unit: "milliseconds",
      })
    ).toBe(false)
    expect(
      isMetricValueContractValid({
        valueType: "distribution",
        calculation: "p95",
        unit: "percent",
      })
    ).toBe(false)
    expect(
      isMetricValueContractValid({
        valueType: "rate",
        calculation: "per-second",
        unit: "errors-per-minute",
      })
    ).toBe(false)
  })

  it("uses category only to group recommendations", () => {
    metricTemplatesByCategory.impact.forEach((templateId) => {
      expect(metricTemplates[templateId].category).toBe("impact")
    })
    expect(
      isMetricValueContractValid({
        valueType: "distribution",
        calculation: "p95",
        unit: "milliseconds",
      })
    ).toBe(true)
  })

  it("groups every named template exactly once", () => {
    const groupedTemplateIds = Object.values(metricTemplatesByCategory).flat()

    expect(groupedTemplateIds).toHaveLength(10)
    expect(new Set(groupedTemplateIds).size).toBe(10)
    expect(groupedTemplateIds.toSorted()).toEqual(
      Object.keys(metricTemplates).toSorted()
    )
  })

  it("requires flag-key capability for flag context", () => {
    expect(supportsFlagContext(["flag-key"])).toBe(true)
    expect(supportsFlagContext(["flag-key", "exposure"])).toBe(true)
    expect(supportsFlagContext(["exposure"])).toBe(false)
    expect(supportsFlagContext([])).toBe(false)
  })
})
