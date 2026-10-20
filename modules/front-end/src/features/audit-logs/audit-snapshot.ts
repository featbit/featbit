import type { AuditLog } from "./audit-logs-types"

export type AuditSnapshotKind = "initial" | "deleted"

// Classify object lifecycle events, not relationship additions/removals.
export function auditSnapshotKind(
  log: AuditLog
): AuditSnapshotKind | undefined {
  const operation = log.operation.toLowerCase()
  if (
    ["FeatureFlag", "Segment", "Member", "Group", "Policy"].includes(
      log.refType
    )
  ) {
    if (["create", "clone"].includes(operation)) return "initial"
    if (["remove", "delete"].includes(operation)) return "deleted"
  }
  if (["creategroup", "createpolicy", "clonepolicy"].includes(operation))
    return "initial"
  if (["deletegroup", "deletepolicy"].includes(operation)) return "deleted"
  if (log.refType === "Member") {
    if (operation === "addmember" && !log.dataChange.previous) return "initial"
    if (
      ["removefromorganization", "removefromworkspace"].includes(operation) &&
      !log.dataChange.current
    )
      return "deleted"
  }
}

export function auditSnapshotLog(log: AuditLog): AuditLog {
  return {
    ...log,
    dataChange: {
      ...log.dataChange,
      previous: "",
      current:
        auditSnapshotKind(log) === "deleted"
          ? log.dataChange.previous
          : log.dataChange.current,
    },
  }
}
