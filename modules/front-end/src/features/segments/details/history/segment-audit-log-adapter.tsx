import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import type { AuditLogTableAdapter } from "@/features/audit-logs/components/audit-log-table-adapter"
import type {
  AuditInstruction,
  AuditLog,
} from "@/features/audit-logs/audit-logs-types"
import { ChangeLedger } from "../components/change-ledger"
import {
  auditEventKind,
  auditFragments,
  segmentSnapshot,
  settingsReviewChanges,
  targetingChanges,
  type ReviewChange,
} from "../segment-details-utils"

function eventTitle(log: AuditLog, t: TFunction) {
  const operation = log.operation.toLowerCase()
  if (operation === "create") {
    return t("segments.detailsPage.history.events.created")
  }
  if (operation === "archive") {
    return t("segments.detailsPage.history.events.archived")
  }
  if (operation === "restore") {
    return t("segments.detailsPage.history.events.restored")
  }
  if (operation === "remove") {
    return t("segments.detailsPage.history.events.removed")
  }
  if (operation === "update") {
    return t(
      `segments.detailsPage.history.events.${auditEventKind(log.instructions)}`
    )
  }
  return t("segments.detailsPage.history.events.unknown", {
    operation: log.operation,
  })
}

function eventSubtitle(log: AuditLog, t: TFunction) {
  const fragments = auditFragments(log.instructions)
  if (!fragments.length) return ""

  const visible = fragments.slice(0, 2).map((fragment) =>
    t(`segments.detailsPage.history.fragments.${fragment.kind}`, {
      count: fragment.count,
      defaultValue: `${fragment.kind} ${fragment.count}`,
    })
  )
  if (fragments.length > 2) {
    visible.push(
      t("segments.detailsPage.history.moreFragments", {
        count: fragments.length - 2,
      })
    )
  }
  return visible.join(" · ")
}

function instructionValue(value: unknown) {
  if (typeof value === "string") return value || "—"
  if (Array.isArray(value)) return value.map(String).join(", ") || "—"
  try {
    return JSON.stringify(value)
  } catch {
    return "—"
  }
}

function instructionText(instruction: AuditInstruction, t: TFunction) {
  return t(`segments.detailsPage.history.instructions.${instruction.kind}`, {
    count: Array.isArray(instruction.value) ? instruction.value.length : 1,
    defaultValue: instruction.kind,
  })
}

function instructionAction(kind: string): ReviewChange["action"] {
  if (kind.startsWith("Add")) return "added"
  if (kind.startsWith("Remove")) return "removed"
  return "updated"
}

function historyChanges(log: AuditLog, t: TFunction): ReviewChange[] {
  const previous = segmentSnapshot(log.dataChange.previous)
  const current = segmentSnapshot(log.dataChange.current)
  if (previous && current) {
    const semantic = [
      ...targetingChanges(previous, current),
      ...settingsReviewChanges(previous, current),
    ]
    if (semantic.length) return semantic
  }

  return log.instructions.map((instruction) => ({
    kind: instruction.kind.includes("Rule") ? "ruleSummary" : "generic",
    label: instructionText(instruction, t),
    literalLabel: true,
    action: instructionAction(instruction.kind),
    current: instructionValue(instruction.value),
  }))
}

export function useSegmentAuditLogAdapter(): AuditLogTableAdapter {
  const { t } = useTranslation()

  return {
    eventTitle: (log) => eventTitle(log, t),
    eventSubtitle: (log) => eventSubtitle(log, t),
    changeDetails: (log) => {
      const changes = historyChanges(log, t)
      return {
        count: changes.length,
        content: changes.length ? (
          <ChangeLedger
            changes={changes}
            layout="history"
            className="max-h-[32rem] bg-transparent p-0"
          />
        ) : null,
      }
    },
  }
}
