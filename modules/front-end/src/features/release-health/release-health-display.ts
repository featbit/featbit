import type { TFunction } from "i18next"
import type {
  HealthAssessment,
  HealthSession,
  HealthSessionEvent,
  ReleaseMetric,
} from "./release-health-types"

type MetricField = "name" | "description" | "changeLabel" | "updatedAt"
type SessionField =
  "monitorName" | "flagName" | "triggerLabel" | "changeSummary"

export function metricSampleText(
  t: TFunction,
  metric: ReleaseMetric,
  field: MetricField
) {
  const fallback =
    field === "changeLabel" || field === "updatedAt"
      ? metric.environment[field]
      : metric[field]

  return t(`releaseHealth.samples.metrics.${metric.key}.${field}`, {
    defaultValue: fallback,
  })
}

export function sessionSampleText(
  t: TFunction,
  session: HealthSession,
  field: SessionField
) {
  return t(`releaseHealth.samples.sessions.${session.id}.${field}`, {
    defaultValue: session[field],
  })
}

export function assessmentSampleText(
  t: TFunction,
  assessment: HealthAssessment,
  field: "reason" | "evidenceWindow"
) {
  return t(
    `releaseHealth.samples.assessments.${assessment.metricId}.${field}`,
    { defaultValue: assessment[field] }
  )
}

export function eventSampleText(
  t: TFunction,
  event: HealthSessionEvent,
  field: "title" | "description"
) {
  return t(`releaseHealth.samples.events.${event.id}.${field}`, {
    defaultValue: event[field],
  })
}

export function ruleSampleText(t: TFunction, rule: string) {
  if (rule === "Observe trend") return t("releaseHealth.monitor.trendOnly")

  const duration = rule.match(/^(.+?) for (\d+) min$/)
  if (duration) {
    return t("releaseHealth.samples.ruleForMinutes", {
      condition: duration[1],
      count: Number(duration[2]),
    })
  }

  return rule
}

export function monitorSampleText(t: TFunction, monitor: string) {
  const keys: Record<string, string> = {
    "Checkout safety monitor": "checkoutSafety",
    "Payment reliability": "paymentReliability",
    "Recommendations observation": "recommendationsObservation",
    "Checkout conversion guard": "checkoutConversionGuard",
    "Checkout resource watch": "checkoutResourceWatch",
    "Search resource watch": "searchResourceWatch",
    "Mobile stability guard": "mobileStabilityGuard",
  }
  const key = keys[monitor]
  return key
    ? t(`releaseHealth.samples.monitors.${key}`, { defaultValue: monitor })
    : monitor
}

export function actionSampleText(t: TFunction, action: string) {
  const keys: Record<string, string> = {
    "Alert owners": "releaseHealth.monitor.alertOwners",
    "Rich webhook": "releaseHealth.monitor.richWebhook",
    "Require approval": "releaseHealth.monitor.requireApproval",
  }
  const key = keys[action]
  return key ? t(key) : action
}

export function noDataPolicySampleText(t: TFunction, policy: string) {
  const key =
    policy === "Wait for required data; notify on Stale or Error"
      ? "releaseHealth.samples.noDataPolicy.waitAndNotify"
      : policy === "Notify and block"
        ? "releaseHealth.samples.noDataPolicy.notifyAndBlock"
        : policy === "Wait"
          ? "releaseHealth.samples.noDataPolicy.wait"
          : null

  return key ? t(key) : policy
}
