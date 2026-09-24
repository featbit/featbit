import { z } from "zod"
import type { TFunction } from "i18next"
import type {
  BindingAlertRule,
  GuardAlertRule,
  MonitorBinding,
} from "../release-health-types"
import type { BindingMetric } from "./monitor-data"

export const defaultAlertRule: GuardAlertRule = {
  operator: ">",
  threshold: 0,
  severity: "critical",
  lookback: 10,
  reducer: "average",
  sustain: 5,
  recovery: 5,
  evaluationInterval: 1,
  warmup: 0,
  dataDelay: 0,
}

export function newAlertRule(name: string) {
  return {
    ...defaultAlertRule,
    id: crypto.randomUUID(),
    name,
    threshold: "",
    webhookId: "",
  }
}

export function bindingDefaults(
  binding?: MonitorBinding,
  ruleName = "Alert rule 1"
) {
  return {
    metricId: binding?.metricId ?? "",
    purpose: binding?.purpose ?? ("trend" as "trend" | "guard"),
    rules:
      binding?.purpose === "guard"
        ? binding.rules.map((rule) => ({
            operator: rule.operator,
            severity: rule.severity,
            lookback: rule.lookback,
            reducer: rule.reducer,
            sustain: rule.sustain,
            recovery: rule.recovery,
            evaluationInterval: rule.evaluationInterval,
            warmup: rule.warmup,
            dataDelay: rule.dataDelay,
            id: rule.id,
            name: rule.name,
            threshold: String(rule.threshold),
            webhookId: rule.webhookId ?? "",
          }))
        : [newAlertRule(ruleName)],
  }
}

export type BindingFormValues = ReturnType<typeof bindingDefaults>

export function bindingSchema(
  t: TFunction,
  metrics: BindingMetric[],
  availableIds: string[],
  enabled = true
) {
  return z
    .object({
      metricId: z.string(),
      purpose: z.enum(["trend", "guard"]),
      rules: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          operator: z.enum([">", ">=", "<", "<="]),
          threshold: z.string(),
          severity: z.enum(["warning", "critical"]),
          lookback: z.number(),
          reducer: z.enum(["latest", "average", "minimum", "maximum"]),
          sustain: z.number(),
          recovery: z.number(),
          evaluationInterval: z.number(),
          warmup: z.number(),
          dataDelay: z.number(),
          webhookId: z.string(),
        })
      ),
    })
    .superRefine((value, ctx) => {
      const fail = (path: (string | number)[], key: string) =>
        ctx.addIssue({
          code: "custom",
          path,
          message: t("releaseHealth.binding." + key),
        })
      const metric = metrics.find((item) => item.id === value.metricId)
      if (!metric || !availableIds.includes(value.metricId))
        fail(["metricId"], "metricRequired")
      else if (enabled && !metric.sourceConnected)
        fail(["metricId"], "sourceRequired")
      if (value.purpose !== "guard") return
      if (!value.rules.length) fail(["rules", "root"], "ruleRequired")
      const names = new Set<string>()
      const ids = new Set<string>()
      value.rules.forEach((rule, index) => {
        const issue = (field: string, key: string) =>
          fail(["rules", index, field], key)
        const name = rule.name.trim().toLocaleLowerCase()
        if (!name || rule.name.trim().length > 80)
          issue("name", "ruleNameRequired")
        else if (names.has(name)) issue("name", "ruleNameDuplicate")
        names.add(name)
        if (!rule.id || ids.has(rule.id)) issue("name", "ruleIdentityInvalid")
        ids.add(rule.id)
        const threshold = Number(rule.threshold)
        const { minimum, maximum } = metric?.resultContract.constraints ?? {}
        if (!rule.threshold.trim() || !Number.isFinite(threshold))
          issue("threshold", "thresholdRequired")
        else if (
          (minimum !== undefined && threshold < minimum) ||
          (maximum !== undefined && threshold > maximum)
        )
          issue("threshold", "thresholdRange")
        if (!rule.webhookId) issue("webhookId", "webhookRequired")
        for (const field of [
          "lookback",
          "sustain",
          "recovery",
          "evaluationInterval",
          "warmup",
          "dataDelay",
        ] as const) {
          const minimum = field === "warmup" || field === "dataDelay" ? 0 : 1
          if (!Number.isInteger(rule[field]) || rule[field] < minimum)
            issue(field, "durationInvalid")
        }
        if (rule.evaluationInterval > rule.lookback)
          issue("evaluationInterval", "intervalTooLong")
      })
    })
}

export function bindingFromForm(
  values: BindingFormValues,
  previous?: MonitorBinding
): MonitorBinding {
  const base = {
    metricId: values.metricId,
    observationMode: "environment" as const,
    enabled: previous?.enabled ?? true,
  }
  if (values.purpose === "trend") return { ...base, purpose: "trend" }
  const previousRules = previous?.purpose === "guard" ? previous.rules : []
  const rules: BindingAlertRule[] = values.rules.map((value) => {
    const next = {
      ...value,
      name: value.name.trim(),
      threshold: Number(value.threshold),
    }
    const old = previousRules.find((rule) => rule.id === next.id)
    // Evidence belongs to this rule's condition, never to its array position.
    const unchanged =
      old &&
      (Object.keys(defaultAlertRule) as (keyof GuardAlertRule)[]).every(
        (key) => old[key] === next[key]
      )
    return { ...next, latestCheck: unchanged ? old.latestCheck : undefined }
  })
  return { ...base, purpose: "guard", rules }
}
