import type { TFunction } from "i18next"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import {
  auditEventKind,
  segmentSnapshot,
  settingsReviewChanges,
  targetingChanges,
  type ReviewChange,
} from "@/features/segments/details/segment-details-utils"
import type {
  AuditInstruction,
  AuditLog,
  AuditObjectIdentity,
} from "./audit-logs-types"

const flagSettingsKinds = new Set([
  "UpdateName",
  "UpdateDescription",
  "AddTags",
  "RemoveTags",
])
const flagVariationKinds = new Set([
  "UpdateVariationType",
  "AddVariation",
  "RemoveVariation",
  "UpdateVariation",
  "UpdateDisabledVariation",
])
const flagTargetingKinds = new Set([
  "UpdateDefaultRuleVariationOrRollouts",
  "UpdateDefaultRuleDispatchKey",
  "AddTargetUsers",
  "RemoveTargetUsers",
  "SetTargetUsers",
  "AddRule",
  "RemoveRule",
  "SetRules",
  "UpdateRuleName",
  "UpdateRuleDispatchKey",
  "AddRuleConditions",
  "RemoveRuleConditions",
  "UpdateRuleCondition",
  "AddValuesToRuleCondition",
  "RemoveValuesFromRuleCondition",
  "UpdateRuleVariationOrRollouts",
])
const flagStatusKinds = new Set([
  "TurnFlagOn",
  "TurnFlagOff",
  "ArchiveFlag",
  "RestoreFlag",
])

function recordSnapshot(value?: string) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function firstString(record: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return ""
}

export function auditObjectIdentity(
  log: AuditLog,
  unavailable: string
): AuditObjectIdentity {
  const operation = log.operation.toLowerCase()
  const preferred =
    operation === "remove"
      ? recordSnapshot(log.dataChange.previous)
      : recordSnapshot(log.dataChange.current)
  const fallback =
    operation === "remove"
      ? recordSnapshot(log.dataChange.current)
      : recordSnapshot(log.dataChange.previous)
  const snapshot = preferred ?? fallback
  const name = firstString(snapshot, ["name"])
  const key = firstString(snapshot, ["key", "keyId"])
  const id = firstString(snapshot, ["id"]) || log.refId

  return {
    id,
    name: name || unavailable,
    key: key || log.refId,
    removed: operation === "remove",
    available: Boolean(name && (key || id)) && operation !== "remove",
  }
}

export function auditTypeLabel(refType: string, t: TFunction) {
  if (refType === "FeatureFlag") return t("auditLogs.featureFlag")
  if (refType === "Segment") return t("auditLogs.segment")
  return refType || t("auditLogs.unknownType")
}

export function auditEventTitle(log: AuditLog, t: TFunction) {
  switch (log.operation.toLowerCase()) {
    case "create":
      return t("auditLogs.created")
    case "archive":
      return t("auditLogs.archived")
    case "restore":
      return t("auditLogs.restored")
    case "remove":
      return t("auditLogs.removed")
    case "applyflagchangerequest":
      return t("auditLogs.appliedChangeRequest")
    case "applyflagschedule":
      return t("auditLogs.appliedSchedule")
    case "update":
      if (log.refType === "Segment") {
        const kind = auditEventKind(log.instructions)
        if (kind === "targeting") return t("auditLogs.updatedTargeting")
        if (kind === "settings") return t("auditLogs.updatedSettings")
        return t("auditLogs.updated")
      }
      if (log.refType === "FeatureFlag") {
        const kinds = log.instructions.map((instruction) => instruction.kind)
        if (kinds.some((kind) => flagStatusKinds.has(kind))) {
          return t("auditLogs.changedStatus")
        }
        if (kinds.some((kind) => flagVariationKinds.has(kind))) {
          return t("auditLogs.updatedVariations")
        }
        if (kinds.some((kind) => flagTargetingKinds.has(kind))) {
          return t("auditLogs.updatedTargeting")
        }
        if (kinds.some((kind) => flagSettingsKinds.has(kind))) {
          return t("auditLogs.updatedSettings")
        }
      }
      return t("auditLogs.updated")
    default:
      return log.operation || t("auditLogs.unknownEvent")
  }
}

function valueCount(value: unknown) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["values", "conditions", "rules", "keyIds"]) {
      if (Array.isArray(record[key])) return record[key].length
    }
  }
  return 1
}

export function humanizeInstructionKind(kind: string) {
  return kind
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
}

export function auditEventFragments(log: AuditLog, t: TFunction) {
  const visible = log.instructions.slice(0, 2).map((instruction) => {
    const count = valueCount(instruction.value)
    const label = humanizeInstructionKind(instruction.kind)
    return count > 1 ? `${label} · ${count}` : label
  })

  if (log.instructions.length > 2) {
    visible.push(
      t("auditLogs.moreFragments", {
        count: log.instructions.length - 2,
      })
    )
  }

  return visible.join(" · ")
}

function instructionAction(kind: string): ChangeReviewItem["action"] {
  if (kind.startsWith("Add") || kind.startsWith("TurnFlagOn")) return "added"
  if (
    kind.startsWith("Remove") ||
    kind.startsWith("TurnFlagOff") ||
    kind.startsWith("Archive")
  ) {
    return "removed"
  }
  return "updated"
}

function primitiveValues(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (
    value.every((item) => ["string", "number", "boolean"].includes(typeof item))
  ) {
    return value.map(String)
  }
  return null
}

function instructionValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return "—"
  }
}

function genericInstructionChanges(
  instructions: AuditInstruction[]
): ReviewChange[] {
  return instructions
    .filter((instruction) => instruction.kind !== "Noop")
    .map((instruction) => {
      const values = primitiveValues(instruction.value)
      return {
        kind: instruction.kind.includes("Rule") ? "ruleSummary" : "generic",
        label: humanizeInstructionKind(instruction.kind),
        literalLabel: true,
        action: instructionAction(instruction.kind),
        ...(values?.length
          ? { values }
          : { current: instructionValue(instruction.value) }),
      }
    })
}

export function auditHistoryChanges(log: AuditLog): ReviewChange[] {
  if (log.refType === "Segment") {
    const previous = segmentSnapshot(log.dataChange.previous)
    const current = segmentSnapshot(log.dataChange.current)
    if (previous && current) {
      const changes = [
        ...targetingChanges(previous, current),
        ...settingsReviewChanges(previous, current),
      ]
      if (changes.length) return changes
    }
  }

  return genericInstructionChanges(log.instructions)
}

export function hasAppliedFilters(input: {
  query: string
  creatorId?: string
  refType?: string
  from?: Date
  to?: Date
}) {
  return Boolean(
    input.query.trim() ||
    input.creatorId ||
    input.refType ||
    input.from ||
    input.to
  )
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function dayAfter(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1
  ).getTime()
}
