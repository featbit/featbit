import type {
  AuditInstruction,
  Segment,
  SegmentCondition,
  SegmentRule,
} from "../segments-types"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import { conditionValues } from "@/features/targeting/targeting-utils"
export {
  conditionValues,
  newTargetingId as newId,
  withConditionValues,
} from "@/features/targeting/targeting-utils"

const targetingKinds = new Set([
  "AddTargetUsersToIncluded",
  "RemoveTargetUsersFromIncluded",
  "AddTargetUsersToExcluded",
  "RemoveTargetUsersFromExcluded",
  "AddRule",
  "RemoveRule",
  "SetRules",
  "UpdateRuleName",
  "AddRuleConditions",
  "RemoveRuleConditions",
  "UpdateRuleCondition",
  "AddValuesToRuleCondition",
  "RemoveValuesFromRuleCondition",
])

const settingsKinds = new Set([
  "UpdateName",
  "UpdateDescription",
  "AddTags",
  "RemoveTags",
])

export function cloneSegment(segment: Segment): Segment {
  return structuredClone(segment)
}

export function normalizedRules(rules: SegmentRule[]) {
  return rules
    .filter((rule) => rule.conditions.length > 0)
    .map((rule) => ({
      ...rule,
      conditions: rule.conditions.map((condition) => ({
        id: condition.id,
        property: condition.property,
        op: condition.op,
        value: condition.value,
      })),
    }))
}

export function stableTargeting(segment: Segment) {
  return JSON.stringify({
    included: segment.included,
    excluded: segment.excluded,
    rules: normalizedRules(segment.rules),
  })
}

export function stableSettings(segment: Segment) {
  return JSON.stringify({
    name: segment.name,
    description: segment.description,
    tags: [...segment.tags].sort(),
  })
}

export function auditEventKind(instructions: AuditInstruction[]) {
  const kinds = instructions.map((instruction) => instruction.kind)
  const hasTargeting = kinds.some((kind) => targetingKinds.has(kind))
  const hasSettings = kinds.some((kind) => settingsKinds.has(kind))
  if (hasTargeting && !hasSettings) return "targeting"
  if (hasSettings && !hasTargeting) return "settings"
  return "segment"
}

function valueCount(value: unknown) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["values", "conditions", "rules"]) {
      if (Array.isArray(record[key])) return record[key].length
    }
  }
  return 1
}

export type AuditFragment = {
  kind: string
  count: number
}

export function auditFragments(instructions: AuditInstruction[]) {
  const order = [
    "AddTargetUsersToIncluded",
    "RemoveTargetUsersFromIncluded",
    "AddTargetUsersToExcluded",
    "RemoveTargetUsersFromExcluded",
    "AddRule",
    "RemoveRule",
    "SetRules",
    "UpdateRuleName",
    "AddRuleConditions",
    "RemoveRuleConditions",
    "UpdateRuleCondition",
    "UpdateName",
    "UpdateDescription",
    "AddTags",
    "RemoveTags",
  ]
  return instructions
    .filter((item) => order.includes(item.kind))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((item) => ({ kind: item.kind, count: valueCount(item.value) }))
}

export function settingsChanges(previous: Segment, current: Segment) {
  const changes: Array<{
    field: "name" | "description" | "tags"
    previous: string | string[]
    current: string | string[]
  }> = []
  if (previous.name !== current.name) {
    changes.push({
      field: "name",
      previous: previous.name,
      current: current.name,
    })
  }
  if (previous.description !== current.description) {
    changes.push({
      field: "description",
      previous: previous.description,
      current: current.description,
    })
  }
  if (
    JSON.stringify([...previous.tags].sort()) !==
    JSON.stringify([...current.tags].sort())
  ) {
    changes.push({
      field: "tags",
      previous: previous.tags,
      current: current.tags,
    })
  }
  return changes
}

export type ReviewChange = ChangeReviewItem & {
  kind:
    "users" | "rule" | "ruleSummary" | "field" | "tags" | "order" | "generic"
  previousRule?: SegmentRule
  currentRule?: SegmentRule
}

function listChanges(
  previous: string[],
  current: string[],
  label: string
): ReviewChange[] {
  const added = current.filter((value) => !previous.includes(value))
  const removed = previous.filter((value) => !current.includes(value))
  return [
    ...(added.length
      ? [
          {
            kind: "users" as const,
            label,
            action: "added" as const,
            affectedCount: added.length,
            values: added,
          },
        ]
      : []),
    ...(removed.length
      ? [
          {
            kind: "users" as const,
            label,
            action: "removed" as const,
            affectedCount: removed.length,
            values: removed,
          },
        ]
      : []),
  ]
}

export function targetingChanges(previous: Segment, current: Segment) {
  const changes = [
    ...listChanges(previous.included, current.included, "includedUsers"),
    ...listChanges(previous.excluded, current.excluded, "excludedUsers"),
  ]
  const previousRules = new Map(previous.rules.map((rule) => [rule.id, rule]))
  const currentRules = new Map(current.rules.map((rule) => [rule.id, rule]))
  for (const rule of current.rules) {
    const old = previousRules.get(rule.id)
    if (!old) {
      changes.push({
        kind: "rule",
        label: rule.name,
        action: "added",
        currentRule: rule,
      })
    } else if (JSON.stringify(old) !== JSON.stringify(rule)) {
      changes.push({
        kind: "rule",
        label: rule.name,
        action: "updated",
        previousRule: old,
        currentRule: rule,
      })
    }
  }
  for (const rule of previous.rules) {
    if (!currentRules.has(rule.id)) {
      changes.push({
        kind: "rule",
        label: rule.name,
        action: "removed",
        previousRule: rule,
      })
    }
  }
  const previousIds = previous.rules.map((rule) => rule.id)
  const currentIds = current.rules.map((rule) => rule.id)
  if (
    previousIds.length === currentIds.length &&
    previousIds.every((id) => currentIds.includes(id)) &&
    previousIds.join(",") !== currentIds.join(",")
  ) {
    changes.push({
      kind: "order",
      label: "ruleOrder",
      action: "updated",
      values: current.rules.map((rule) => rule.name),
    })
  }
  return changes
}

export function describeCondition(condition: SegmentCondition) {
  const values = conditionValues(condition).join(", ")
  return `${condition.property} ${condition.op} ${values}`.trim()
}

export function describeRule(rule: SegmentRule) {
  return rule.conditions
    .map((condition) => {
      const values = conditionValues(condition).join(", ")
      return `${condition.property} ${condition.op} ${values}`.trim()
    })
    .join(" · ")
}

export function settingsReviewChanges(
  previous: Segment,
  current: Segment
): ReviewChange[] {
  return settingsChanges(previous, current).map((change) => {
    if (change.field === "tags") {
      const previousTags = change.previous as string[]
      const currentTags = change.current as string[]
      const added = currentTags.filter((tag) => !previousTags.includes(tag))
      const removed = previousTags.filter((tag) => !currentTags.includes(tag))
      return {
        kind: "tags",
        label: "tags",
        valueGroups: [
          ...(added.length
            ? [{ action: "added" as const, values: added }]
            : []),
          ...(removed.length
            ? [{ action: "removed" as const, values: removed }]
            : []),
        ],
      }
    }
    return {
      kind: "field",
      label: change.field,
      action: "updated",
      previous: change.previous as string,
      current: change.current as string,
    }
  })
}

export function segmentSnapshot(value?: string): Segment | null {
  const parsed = safeJson(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return null
  const record = parsed as Record<string, unknown>
  if (
    !Array.isArray(record.included) ||
    !Array.isArray(record.excluded) ||
    !Array.isArray(record.rules) ||
    !Array.isArray(record.tags)
  ) {
    return null
  }
  return parsed as Segment
}

export function safeJson(value?: string) {
  if (!value) return {}
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}
