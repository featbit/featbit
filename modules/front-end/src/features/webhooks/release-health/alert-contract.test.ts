import { describe, expect, it } from "vitest"
import {
  unitKindsByMeasurementKind,
  resultContractRange,
} from "@/features/release-health/metrics/metric-contract"
import {
  ALERT_PROFILES,
  ALERT_SAMPLE_CASES,
  DEFAULT_ALERT_SAMPLE,
  alertSampleProfile,
  alertSampleUnit,
} from "./alert-contract-samples"
import {
  ALERT_EVENT_CATALOG,
  ALERT_NON_EVENT_REASONS,
} from "./alert-event-catalog"
import {
  ALERT_EVENTS,
  ALERT_PAYLOAD_TEMPLATE,
  ALERT_TEMPLATE_VARIABLES,
  alertPayloadSample,
  renderAlertPayload,
  validateAlertTemplate,
} from "./alert-payload"
import { alertVariableGroups } from "./alert-template-schema"

describe("Release Health notification contracts", () => {
  it("enumerates exactly two events, all nine supported profiles and all 18 rate units", () => {
    expect(ALERT_EVENT_CATALOG.map((event) => event.type)).toEqual([
      "alert.triggered",
      "alert.recovered",
    ])
    expect(ALERT_PROFILES.map((profile) => profile.id).sort()).toEqual(
      Object.entries(unitKindsByMeasurementKind)
        .flatMap(([kind, units]) => units.map((unit) => `${kind}-${unit}`))
        .sort()
    )
    expect(
      new Set(
        ALERT_SAMPLE_CASES.filter(
          (sample) => sample.profileId === "rate-rate"
        ).map((sample) => `${sample.rateNumerator}/${sample.ratePeriod}`)
      ).size
    ).toBe(18)
    expect(ALERT_NON_EVENT_REASONS).toEqual([
      "collecting",
      "no-data",
      "stale",
      "error",
      "invalid-contract",
      "trend",
      "paused-removed",
      "ongoing",
    ])
  })

  it.each(ALERT_SAMPLE_CASES)(
    "preserves canonical values and contract types for $profileId / $rateNumerator / $ratePeriod / $severity",
    (sample) => {
      const profile = alertSampleProfile(sample)
      const unit = alertSampleUnit(sample)
      const intrinsic = resultContractRange(unit)
      for (const event of ALERT_EVENTS) {
        const actual = JSON.parse(
          renderAlertPayload(ALERT_PAYLOAD_TEMPLATE, event, sample)
        )
        expect(actual).toEqual(alertPayloadSample(event, sample))
        expect(actual.metric.resultContract).toMatchObject({
          schemaVersion: 1,
          resultKind: "numeric_time_series",
          cardinality: "single",
          measurementKind: profile.measurementKind,
          unit,
          constraints: {
            minimum: profile.minimum,
            maximum: profile.maximum,
            allowNaN: false,
            allowInfinity: false,
          },
        })
        expect(actual.evaluation.dataStatus).toBe("ready")
        expect(actual.evaluation.healthStatus).toBe(
          event === "alert.triggered" ? sample.severity : "healthy"
        )
        expect(Number.isFinite(actual.evaluation.value)).toBe(true)
        expect(actual.evaluation.value).toBeGreaterThanOrEqual(
          intrinsic.minimum
        )
        if (intrinsic.maximum !== undefined)
          expect(actual.evaluation.value).toBeLessThanOrEqual(intrinsic.maximum)
        const value = actual.evaluation.value as number
        const threshold = actual.condition.threshold as number
        const breached =
          profile.operator === ">"
            ? value > threshold
            : profile.operator === ">="
              ? value >= threshold
              : profile.operator === "<"
                ? value < threshold
                : value <= threshold
        expect(breached).toBe(event === "alert.triggered")
        expect(actual.alert.recoveredAt).toBe(
          event === "alert.triggered" ? null : actual.event.happenedAt
        )
      }
    }
  )

  it("documents every leaf, nullable unit field and enum rather than deriving them from a percent-only sample", () => {
    const leaves = (object: object, prefix = ""): string[] =>
      Object.entries(object).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key
        return value !== null && typeof value === "object"
          ? leaves(value, path)
          : [path]
      })
    for (const path of leaves(alertPayloadSample("alert.triggered")))
      expect(ALERT_TEMPLATE_VARIABLES).toContain(path)
    const groups = alertVariableGroups()
    const unit = groups.find((group) => group.name === "unit")!
    expect(unit.fields.find((field) => field.key === "scale")?.values).toEqual([
      "zero_to_one_hundred",
      "zero_to_one",
      null,
    ])
    expect(unit.fields.find((field) => field.key === "per")?.type).toBe(
      "string | null"
    )
    expect(unit.fields.find((field) => field.key === "per")?.triggered).toBe(
      "null"
    )
    const rate = alertVariableGroups({
      ...DEFAULT_ALERT_SAMPLE,
      profileId: "rate-rate",
      rateNumerator: "bytes",
      ratePeriod: "hour",
    }).find((group) => group.name === "unit")!
    expect(rate.fields.find((field) => field.key === "per")?.triggered).toBe(
      '"hour"'
    )
    expect(rate.fields.find((field) => field.key === "scale")?.triggered).toBe(
      "null"
    )
  })

  it("validates nondefault profiles, rate units, severities and the recovery branch", () => {
    expect(validateAlertTemplate(ALERT_PAYLOAD_TEMPLATE)).toBeNull()
    const rateOnlyFailure =
      '{{#if (eq metric.resultContract.unit.per "hour")}}invalid{{else}}{}{{/if}}'
    expect(validateAlertTemplate(rateOnlyFailure)).toContain(
      "rate-rate / events/h"
    )
    const dataOnlyFailure =
      '{{#if (eq metric.resultContract.unit.base "byte")}}invalid{{else}}{}{{/if}}'
    expect(validateAlertTemplate(dataOnlyFailure)).toContain("gauge-data")
    const recoveryOnlyFailure =
      '{{#if (eq event.type "alert.recovered")}}invalid{{else}}{}{{/if}}'
    expect(validateAlertTemplate(recoveryOnlyFailure)).toContain(
      "alert.recovered"
    )
    const warningOnlyFailure =
      '{{#if (eq rule.severity "warning")}}invalid{{else}}{}{{/if}}'
    expect(validateAlertTemplate(warningOnlyFailure)).toContain("warning")
  })
})
