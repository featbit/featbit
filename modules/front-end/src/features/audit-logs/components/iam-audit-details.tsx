import { useTranslation } from "react-i18next"
import { ChangeLedger } from "@/features/change-review/change-ledger"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import { iamChanges } from "../iam-audit-changes"
import type { AuditLog } from "../audit-logs-types"
import { auditSnapshotKind, auditSnapshotLog } from "../audit-snapshot"

export function IamAuditDetails({ log }: { log: AuditLog }) {
  const { t } = useTranslation()
  const snapshot = !!auditSnapshotKind(log)
  const changes: ChangeReviewItem[] = iamChanges(
    snapshot ? auditSnapshotLog(log) : log
  ).map((change) => ({
    kind: change.field,
    label: change.label ?? "",
    action: !change.before ? "added" : !change.after ? "removed" : "updated",
    previous: change.before || undefined,
    current: change.after || undefined,
  }))
  if (snapshot) {
    for (const field of ["members", "groups", "policies"]) {
      const entries = changes.filter((change) => change.kind === field)
      if (!entries.length) continue
      const first = changes.indexOf(entries[0])
      for (let index = changes.length - 1; index >= 0; index--)
        if (changes[index].kind === field) changes.splice(index, 1)
      changes.splice(first, 0, {
        kind: field,
        label: "",
        valueGroups: [
          {
            action: "added",
            values: entries.map((entry) => entry.current ?? ""),
          },
        ],
      })
    }
  }
  return (
    <div className="space-y-3">
      {log.dataChange.clonedFrom ? (
        <p className="text-sm text-muted-foreground">
          {t("auditLogs.clonedFrom")}:{" "}
          <span className="font-mono">
            policy/{log.dataChange.clonedFrom.key}
          </span>
        </p>
      ) : null}
      {snapshot && !changes.length ? (
        <p className="text-sm text-muted-foreground">
          {t("auditLogs.snapshotUnavailable")}
        </p>
      ) : snapshot ? (
        <div className="max-h-[32rem] space-y-6 overflow-y-auto">
          <IamLedger
            changes={changes.filter((change) => !change.label)}
            snapshot
          />
          {[
            ...new Set(changes.map((change) => change.label).filter(Boolean)),
          ].map((id, index) => (
            <section key={id}>
              <h4 className="px-2 text-[13px] font-semibold text-foreground">
                {t("auditLogs.permissionStatement", { number: index + 1 })}
              </h4>
              <p className="mt-1 px-2 font-mono text-xs break-all text-muted-foreground">
                {id}
              </p>
              <IamLedger
                changes={changes
                  .filter((change) => change.label === id)
                  .map((change) => ({ ...change, label: "" }))}
                snapshot
              />
            </section>
          ))}
        </div>
      ) : (
        <IamLedger changes={changes} />
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
    />
  )
}
