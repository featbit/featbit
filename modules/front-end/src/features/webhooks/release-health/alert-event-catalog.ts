import {
  alertSampleProfile,
  alertSampleUnit,
  canonicalUnitLabel,
  DEFAULT_ALERT_SAMPLE,
  type AlertSampleOptions,
} from "./alert-contract-samples"

export const ALERT_EVENTS = ["alert.triggered", "alert.recovered"] as const
export type AlertEvent = (typeof ALERT_EVENTS)[number]
export const ALERT_EVENT_CATALOG = [
  { type: "alert.triggered", label: "triggered", help: "triggeredHelp" },
  { type: "alert.recovered", label: "recovered", help: "recoveredHelp" },
] as const
// Unavailable/invalid data and operational changes are not notification events.
export const ALERT_NON_EVENT_REASONS = [
  "collecting",
  "no-data",
  "stale",
  "error",
  "invalid-contract",
  "trend",
  "paused-removed",
  "ongoing",
] as const

// These are sample evidence, never the currently selected flag's live data.
export function alertPayloadSample(
  type: AlertEvent,
  sample = DEFAULT_ALERT_SAMPLE
) {
  const profile = alertSampleProfile(sample)
  const unit = alertSampleUnit(sample)
  const recovered = type === "alert.recovered"
  const happenedAt = recovered ? "2026-09-17T02:20:00Z" : "2026-09-17T02:10:00Z"
  return {
    event: { id: `sample-${type}`, type, happenedAt },
    organization: { id: "sample-org", name: "Example organization" },
    project: { id: "sample-project", key: "storefront", name: "Storefront" },
    environment: { id: "sample-env", key: "production", name: "Production" },
    flag: { id: "sample-flag", key: "new-checkout", name: "New checkout" },
    metric: {
      id: "sample-metric",
      key: profile.key,
      name: profile.name,
      version: 3,
      versionId: "sample-metric-version-3",
      resultSemantics: profile.semantics,
      // Compatibility label. The versioned structured unit is authoritative.
      unit: canonicalUnitLabel(unit),
      fractionDigits: profile.fractionDigits,
      resultContract: {
        schemaVersion: 1,
        resultKind: "numeric_time_series",
        cardinality: "single",
        measurementKind: profile.measurementKind,
        unit: {
          kind: unit.kind,
          scale: "scale" in unit ? unit.scale : null,
          base: "base" in unit ? unit.base : null,
          numerator: "numerator" in unit ? unit.numerator : null,
          per: "per" in unit ? unit.per : null,
        },
        constraints: {
          minimum: profile.minimum,
          maximum: profile.maximum,
          allowNaN: false,
          allowInfinity: false,
        },
      },
    },
    binding: { id: "sample-binding" },
    rule: {
      id: "sample-rule",
      name: `${profile.name} guard`,
      revision: 1,
      severity: sample.severity,
    },
    condition: {
      operator: profile.operator,
      threshold: profile.threshold,
      lookbackMinutes: 5,
      reducer: profile.reducer,
      sustainMinutes: 5,
      recoveryMinutes: 5,
      evaluationIntervalMinutes: 1,
      warmupMinutes: 5,
      dataDelayMinutes: 1,
    },
    evaluation: {
      windowStart: recovered ? "2026-09-17T02:14:00Z" : "2026-09-17T02:04:00Z",
      windowEnd: recovered ? "2026-09-17T02:19:00Z" : "2026-09-17T02:09:00Z",
      value: recovered ? profile.recovered : profile.trigger,
      dataStatus: "ready",
      checkedAt: happenedAt,
      healthStatus: recovered ? "healthy" : sample.severity,
    },
    alert: {
      id: "sample-alert-cycle",
      triggeredAt: "2026-09-17T02:10:00Z",
      recoveredAt: recovered ? happenedAt : null,
    },
    evidence: {
      url: "https://example.com/release-health/evidence/sample-check",
      sourceBindingRevision: 1,
    },
  }
}
export function alertSampleDescription(sample: AlertSampleOptions) {
  return `${sample.profileId} / ${canonicalUnitLabel(alertSampleUnit(sample))} / ${sample.severity}`
}
