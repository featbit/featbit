import {
  rateNumerators,
  ratePeriods,
} from "@/features/release-health/metrics/metric-contract"
import {
  ALERT_SAMPLE_CASES,
  DEFAULT_ALERT_SAMPLE,
  type AlertSampleOptions,
} from "./alert-contract-samples"
import { ALERT_EVENTS, alertPayloadSample } from "./alert-event-catalog"

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue }
const groupDefinitions = [
  ["event", "event"],
  ["organization", "organization"],
  ["project", "project"],
  ["environment", "environment"],
  ["flag", "flag"],
  ["metric", "metric"],
  ["resultContract", "metric.resultContract"],
  ["unit", "metric.resultContract.unit"],
  ["constraints", "metric.resultContract.constraints"],
  ["binding", "binding"],
  ["rule", "rule"],
  ["condition", "condition"],
  ["evaluation", "evaluation"],
  ["alert", "alert"],
  ["evidence", "evidence"],
] as const
const enumValues: Record<
  string,
  readonly (string | number | boolean | null)[]
> = {
  "event.type": ALERT_EVENTS,
  "metric.resultContract.schemaVersion": [1],
  "metric.resultContract.resultKind": ["numeric_time_series"],
  "metric.resultContract.cardinality": ["single"],
  "metric.resultContract.measurementKind": ["gauge", "count", "ratio", "rate"],
  "metric.resultContract.unit.kind": [
    "count",
    "percent",
    "ratio",
    "duration",
    "data",
    "rate",
  ],
  "metric.resultContract.unit.scale": [
    "zero_to_one_hundred",
    "zero_to_one",
    null,
  ],
  "metric.resultContract.unit.base": ["millisecond", "byte", null],
  "metric.resultContract.unit.numerator": [...rateNumerators, null],
  "metric.resultContract.unit.per": [...ratePeriods, null],
  "metric.resultContract.constraints.allowNaN": [false],
  "metric.resultContract.constraints.allowInfinity": [false],
  "rule.severity": ["warning", "critical"],
  "condition.operator": [">", ">=", "<", "<="],
  "condition.reducer": ["latest", "average", "minimum", "maximum"],
  "evaluation.dataStatus": ["ready"],
  "evaluation.healthStatus": ["healthy", "warning", "critical"],
}
const notes: Record<string, string> = {
  "event.type": "eventType",
  "metric.versionId": "version",
  "metric.unit": "legacyUnit",
  "metric.fractionDigits": "precision",
  "metric.resultContract.unit.scale": "scale",
  "metric.resultContract.unit.base": "base",
  "metric.resultContract.unit.numerator": "rate",
  "metric.resultContract.unit.per": "rate",
  "metric.resultContract.constraints.minimum": "constraints",
  "metric.resultContract.constraints.maximum": "constraints",
  "condition.threshold": "canonical",
  "evaluation.value": "canonical",
  "evaluation.dataStatus": "readyOnly",
  "evaluation.healthStatus": "health",
  "alert.recoveredAt": "recovery",
  "evidence.sourceBindingRevision": "version",
}
function atPath(object: JsonValue, path: string): JsonValue {
  return path.split(".").reduce<JsonValue>((value, key) => {
    if (value === null || typeof value !== "object" || !(key in value))
      throw new Error(`Unknown field: ${path}`)
    return value[key]
  }, object)
}
const examples = ALERT_SAMPLE_CASES.flatMap((sample) =>
  ALERT_EVENTS.map((event) => alertPayloadSample(event, sample))
)
export const ALERT_TEMPLATE_GROUPS = groupDefinitions.map(([name, path]) => ({
  name,
  path,
  expression: `{{${path}}}`,
  fields: Object.entries(atPath(examples[0], path) as Record<string, JsonValue>)
    .filter(([, value]) => value === null || typeof value !== "object")
    .map(([key]) => {
      const fieldPath = `${path}.${key}`
      const values = examples.map((sample) => atPath(sample, fieldPath))
      const types = [
        ...new Set(
          values.filter((value) => value !== null).map((value) => typeof value)
        ),
      ]
      const type = [...types, ...(values.includes(null) ? ["null"] : [])].join(
        " | "
      )
      return {
        key,
        path: fieldPath,
        expression: `{{${fieldPath}}}`,
        type,
        values: enumValues[fieldPath],
        note: notes[fieldPath],
      }
    }),
}))
export function alertVariableGroups(
  sample: AlertSampleOptions = DEFAULT_ALERT_SAMPLE
) {
  const triggered = alertPayloadSample("alert.triggered", sample)
  const recovered = alertPayloadSample("alert.recovered", sample)
  return ALERT_TEMPLATE_GROUPS.map((group) => ({
    ...group,
    fields: group.fields.map((field) => ({
      ...field,
      triggered: JSON.stringify(atPath(triggered, field.path)),
      recovered: JSON.stringify(atPath(recovered, field.path)),
    })),
  }))
}
export const ALERT_TEMPLATE_VARIABLES = ALERT_TEMPLATE_GROUPS.flatMap(
  (group) => [group.path, ...group.fields.map((field) => field.path)]
)
const fieldTypes = new Map(
  ALERT_TEMPLATE_GROUPS.flatMap((group) =>
    group.fields.map((field) => [field.path, field.type] as const)
  )
)
function templateObject(
  object: Record<string, JsonValue>,
  prefix = "",
  level = 0
): string {
  const indent = "  ".repeat(level + 1)
  return `{\n${Object.entries(object)
    .map(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key
      const expression = `{{${path}}}`
      const content =
        value !== null && typeof value === "object"
          ? templateObject(value, path, level + 1)
          : fieldTypes.get(path) === "string"
            ? JSON.stringify(expression)
            : expression
      return `${indent}"${key}": ${content}`
    })
    .join(",\n")}\n${"  ".repeat(level)}}`
}
export const ALERT_PAYLOAD_TEMPLATE = templateObject(
  alertPayloadSample("alert.triggered")
)
