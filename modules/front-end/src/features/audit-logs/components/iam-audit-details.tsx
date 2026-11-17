import { useTranslation } from "react-i18next"
import { ChangeLedger } from "@/features/change-review/change-ledger"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import {
  iamChanges,
  iamSnapshotFields,
  iamStatementChanges,
  iamSnapshotReadable,
} from "../iam-audit-changes"
import { IamStatementChangeDetails } from "./iam-statement-change"
import type { AuditLog } from "../audit-logs-types"
import { auditSnapshotKind, auditSnapshotLog } from "../audit-snapshot"

function IamReference({ value }: { value: string }) {
  const separator = value.lastIndexOf("\n")
  const name = separator < 0 ? value : value.slice(0, separator)
  const rn = separator < 0 ? "" : value.slice(separator + 1)
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-sm break-words text-foreground">{name || rn || "—"}</p>
      {name && rn ? (
        <p className="font-mono text-xs break-all text-muted-foreground">
          {rn}
        </p>
      ) : null}
    </div>
  )
}

export function IamAuditDetails({ log }: { log: AuditLog }) {
  const { t } = useTranslation()
  const snapshot = !!auditSnapshotKind(log)
  const displayLog = snapshot ? auditSnapshotLog(log) : log
  const unavailable =
    !iamSnapshotReadable(displayLog.dataChange.current) ||
    (!snapshot && !iamSnapshotReadable(displayLog.dataChange.previous))
  const statements = unavailable ? [] : iamStatementChanges(displayLog)
  const changes: ChangeReviewItem[] = (
    unavailable
      ? []
      : snapshot
        ? iamSnapshotFields(displayLog)
        : iamChanges(log)
  ).map((change) => ({
    kind: change.field,
    label: change.label ?? "",
    action: ["members", "groups", "policies"].includes(change.field)
      ? !change.before
        ? "added"
        : "removed"
      : "updated",
    previous: snapshot ? undefined : change.before,
    current: snapshot ? change.after || undefined : change.after,
    ...(change.values?.length
      ? { valueGroups: [{ action: "added" as const, values: change.values }] }
      : {}),
  }))
  const fieldChanges = changes.filter(
    (change) => log.refType !== "Policy" || !change.label
  )
  return (
    <div className="space-y-3">
      {unavailable || (snapshot && !changes.length) ? (
        <p className="text-sm text-muted-foreground">
          {t("auditLogs.snapshotUnavailable")}
        </p>
      ) : !fieldChanges.length && !statements.length ? (
        <p className="py-5 text-center text-sm text-muted-foreground">
          {t("auditLogs.noSemanticChanges")}
        </p>
      ) : (
        <div className="max-h-[32rem] space-y-6 overflow-y-auto">
          {fieldChanges.length > 0 ? (
            <IamLedger changes={fieldChanges} snapshot={snapshot} />
          ) : null}
          {statements.map((change, index) => (
            <IamStatementChangeDetails
              key={change.id}
              change={change}
              lifecycle={snapshot}
              first={index === 0 && fieldChanges.length === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function IamLedger({
  changes,
  snapshot = false,
}: {
  changes: ChangeReviewItem[]
  snapshot?: boolean
}) {
  const { t } = useTranslation()
  return (
    <ChangeLedger
      changes={changes}
      layout="history"
      snapshot={snapshot}
      className={
        snapshot
          ? "max-h-none bg-transparent p-0 whitespace-pre-wrap"
          : "max-h-[32rem] bg-transparent p-0 whitespace-pre-wrap"
      }
      copy={{
        label: (change) => t(`auditLogs.iamFields.${change.kind}`),
        action: (action) => t(`featureFlags.detailsPage.review.${action}`),
        actionCount: (action, count) =>
          t("featureFlags.detailsPage.review.actionCount", {
            action: t(`featureFlags.detailsPage.review.${action}`),
            count,
          }),
        showMore: (count) =>
          t("featureFlags.detailsPage.review.showMore", { count }),
        showLess: t("featureFlags.detailsPage.review.showLess"),
      }}
      renderLabel={(change) => (
        <>
          <span>{t(`auditLogs.iamFields.${change.kind}`)}</span>
          {change.label ? (
            <span className="mt-1 block font-mono text-xs break-all text-muted-foreground">
              {change.label}
            </span>
          ) : null}
        </>
      )}
      renderValue={(value) => <IamReference value={value} />}
      renderContent={(change) =>
        ["members", "groups", "policies"].includes(change.kind) ? (
          <IamReference value={change.current || change.previous || ""} />
        ) : undefined
      }
    />
  )
}
