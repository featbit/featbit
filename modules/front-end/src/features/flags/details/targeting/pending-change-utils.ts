import type { FeatureFlag, PendingFlagChange } from "../../flags-types"
import {
  targetingReviewChanges,
  type FlagTargetingReviewChange,
} from "./targeting-utils"

export type PendingAction = "approve" | "decline" | "apply"
export type PendingStatus = PendingFlagChange["status"]
export type StatusFilter = "all" | PendingStatus

function changeRequestId(item: PendingFlagChange) {
  return item.changeRequestId ?? (item.type === "ChangeRequest" ? item.id : "")
}

export function canReview(item: PendingFlagChange, currentUserId?: string) {
  return Boolean(
    currentUserId &&
    changeRequestId(item) &&
    item.status === "PendingReview" &&
    item.reviewers?.some((reviewer) => reviewer.memberId === currentUserId)
  )
}

export function canApply(item: PendingFlagChange, currentUserId?: string) {
  if (
    !currentUserId ||
    item.type !== "ChangeRequest" ||
    item.status !== "Approved"
  ) {
    return false
  }
  return (
    item.creatorId === currentUserId ||
    Boolean(
      item.reviewers?.some(
        (reviewer) =>
          reviewer.memberId === currentUserId && reviewer.action === "Approve"
      )
    )
  )
}

function parseSnapshot(value?: string) {
  if (!value) return null
  try {
    return JSON.parse(value) as FeatureFlag
  } catch {
    return null
  }
}

function humanizeInstructionKind(kind: string) {
  return kind
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
}

function instructionValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" || typeof item === "number" ? String(item) : ""
      )
      .filter(Boolean)
  }
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)]
  }
  return []
}

export function pendingChanges(
  item: PendingFlagChange,
  labels: { flagOn: string; flagOff: string }
): FlagTargetingReviewChange[] {
  const previous = parseSnapshot(item.dataChange?.previous)
  const current = parseSnapshot(item.dataChange?.current)
  if (previous && current) {
    const changes = targetingReviewChanges(previous, current, labels)
    if (changes.length) return changes
  }
  return (item.instructions ?? [])
    .filter((instruction) => instruction.kind !== "Noop")
    .map((instruction) => ({
      kind: instruction.kind,
      label: humanizeInstructionKind(instruction.kind),
      literalLabel: true,
      action: instruction.kind.startsWith("Add")
        ? "added"
        : instruction.kind.startsWith("Remove")
          ? "removed"
          : "updated",
      values: instructionValue(instruction.value),
    }))
}

export function statusClassName(status: PendingStatus) {
  switch (status) {
    case "PendingReview":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
    case "Approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
    case "PendingExecution":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300"
    case "Declined":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    case "Applied":
      return "border-border bg-muted text-muted-foreground"
  }
}
