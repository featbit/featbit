import type { TFunction } from "i18next"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import type { FeatureFlag } from "@/features/flags/flags-types"
import {
  targetingReviewChanges,
  type FlagTargetingReviewChange,
} from "@/features/flags/details/targeting/targeting-utils"
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

function flagSnapshot(value?: string) {
  return recordSnapshot(value) as FeatureFlag | null
}

function flagFieldChange(
  label: string,
  previous: string | undefined,
  current: string | undefined
): FlagTargetingReviewChange | null {
  if (previous === current) return null
  return {
    kind: "field",
    label,
    literalLabel: true,
    action:
      previous === undefined
        ? "added"
        : current === undefined
          ? "removed"
          : "updated",
    previous,
    current,
  }
}

function flagState(flag: FeatureFlag, t: TFunction) {
  if (flag.isArchived) return t("featureFlags.archive")
  if (flag.isEnabled === true) return t("featureFlags.on")
  if (flag.isEnabled === false) return t("featureFlags.off")
  return undefined
}

function boundedValue(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}…` : value
}

function variationSummary(variation: { name?: string; value: string }) {
  return variation.name?.trim() || boundedValue(variation.value)
}

function variationDetail(variation: { name?: string; value: string }) {
  const value = boundedValue(variation.value)
  return variation.name?.trim() ? `${variation.name} · ${value}` : value
}

function flagSnapshotChanges(
  previous: FeatureFlag,
  current: FeatureFlag,
  t: TFunction
): FlagTargetingReviewChange[] {
  const changes: FlagTargetingReviewChange[] = []
  const fields = [
    flagFieldChange(
      t("featureFlags.status"),
      flagState(previous, t),
      flagState(current, t)
    ),
    flagFieldChange(t("featureFlags.editor.name"), previous.name, current.name),
    flagFieldChange(
      t("featureFlags.detailsPage.key"),
      previous.key,
      current.key
    ),
    flagFieldChange(
      t("featureFlags.editor.description"),
      previous.description || undefined,
      current.description || undefined
    ),
    flagFieldChange(
      t("featureFlags.variationsEditor.type"),
      previous.variationType?.toUpperCase(),
      current.variationType?.toUpperCase()
    ),
  ]
  changes.push(...fields.filter((change) => change !== null))

  const previousTags = previous.tags ?? []
  const currentTags = current.tags ?? []
  const addedTags = currentTags.filter((tag) => !previousTags.includes(tag))
  const removedTags = previousTags.filter((tag) => !currentTags.includes(tag))
  if (addedTags.length || removedTags.length) {
    changes.push({
      kind: "tags",
      label: t("featureFlags.detailsPage.tags"),
      literalLabel: true,
      valueGroups: [
        ...(addedTags.length
          ? [{ action: "added" as const, values: addedTags }]
          : []),
        ...(removedTags.length
          ? [{ action: "removed" as const, values: removedTags }]
          : []),
      ],
    })
  }

  const previousVariations = new Map(
    (previous.variations ?? []).map((variation) => [variation.id, variation])
  )
  const currentVariations = new Map(
    (current.variations ?? []).map((variation) => [variation.id, variation])
  )
  const addedVariations = (current.variations ?? [])
    .filter((variation) => !previousVariations.has(variation.id))
    .map(variationSummary)
  const removedVariations = (previous.variations ?? [])
    .filter((variation) => !currentVariations.has(variation.id))
    .map(variationSummary)
  if (addedVariations.length || removedVariations.length) {
    changes.push({
      kind: "variations",
      label: t("featureFlags.variationsEditor.variations"),
      literalLabel: true,
      valueGroups: [
        ...(addedVariations.length
          ? [{ action: "added" as const, values: addedVariations }]
          : []),
        ...(removedVariations.length
          ? [{ action: "removed" as const, values: removedVariations }]
          : []),
      ],
    })
  }
  for (const variation of current.variations ?? []) {
    const before = previousVariations.get(variation.id)
    if (
      before &&
      (before.name !== variation.name || before.value !== variation.value)
    ) {
      changes.push({
        kind: "variation",
        label: variation.name || before.name || variation.value,
        literalLabel: true,
        action: "updated",
        previous: variationDetail(before),
        current: variationDetail(variation),
      })
    }
  }

  changes.push(
    ...targetingReviewChanges(previous, current, {
      flagOn: t("featureFlags.detailsPage.flagOn"),
      flagOff: t("featureFlags.detailsPage.flagOff"),
    })
  )
  return changes
}

export function auditHistoryChanges(
  log: AuditLog,
  t: TFunction
): ReviewChange[] | FlagTargetingReviewChange[] {
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

  if (log.refType === "FeatureFlag") {
    const operation = log.operation.toLowerCase()
    const previous =
      flagSnapshot(log.dataChange.previous) ??
      (operation === "create" ? ({} as FeatureFlag) : null)
    const current =
      flagSnapshot(log.dataChange.current) ??
      (operation === "remove" ? ({} as FeatureFlag) : null)
    if (previous && current) {
      const changes = flagSnapshotChanges(previous, current, t)
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
