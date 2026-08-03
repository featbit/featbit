import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChangeLedger as SharedChangeLedger } from "@/features/change-review/change-ledger"
import { useFlagChangeLedgerAdapter } from "@/features/flags/details/targeting/use-flag-change-ledger-adapter"
import type { FlagTargetingReviewChange } from "@/features/flags/details/targeting/targeting-utils"
import { ChangeLedger } from "@/features/segments/details/components/change-ledger"
import type { ReviewChange } from "@/features/segments/details/segment-details-utils"
import {
  auditDecisionSnapshot,
  auditEventFragments,
  auditEventTitle,
  auditHistoryChanges,
  isChangeRequestDecisionOperation,
} from "../audit-log-utils"
import type { AuditLog } from "../audit-logs-types"

export type AuditLogChangeDetails = {
  count: number
  content: ReactNode
  kind?: "changes" | "decision"
}

export type AuditLogTableAdapter = {
  eventTitle: (log: AuditLog) => string
  eventSubtitle: (log: AuditLog) => string
  changeDetails: (log: AuditLog) => AuditLogChangeDetails
}

export function useDefaultAuditLogTableAdapter(): AuditLogTableAdapter {
  const { t } = useTranslation()
  const flagLedger = useFlagChangeLedgerAdapter()

  return {
    eventTitle: (log) => auditEventTitle(log, t),
    eventSubtitle: (log) => auditEventFragments(log, t),
    changeDetails: (log) => {
      if (isChangeRequestDecisionOperation(log.operation)) {
        const snapshot = auditDecisionSnapshot(log)
        const proposedChanges = snapshot?.proposedDataChange
          ? auditHistoryChanges(
              {
                ...log,
                operation: "Update",
                dataChange: snapshot.proposedDataChange,
                instructions: [],
              },
              t
            )
          : []

        return {
          count: proposedChanges.length,
          kind: "decision",
          content: (
            <div className="space-y-4">
              <p className="text-sm">{auditEventTitle(log, t)}</p>
              {snapshot && snapshot.requestComment !== null ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("auditLogs.requestComment")}
                  </p>
                  <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                    {snapshot.requestComment || "—"}
                  </p>
                </div>
              ) : null}
              {snapshot?.proposedDataChange ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("auditLogs.proposedChanges")}
                  </p>
                  {proposedChanges.length ? (
                    <SharedChangeLedger
                      changes={proposedChanges as FlagTargetingReviewChange[]}
                      layout="history"
                      className="max-h-[32rem] bg-transparent p-0"
                      {...flagLedger}
                    />
                  ) : (
                    <p className="py-3 text-sm text-muted-foreground">
                      {t("auditLogs.noSemanticChanges")}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ),
        }
      }

      const changes = auditHistoryChanges(log, t)

      if (!changes.length) return { count: 0, content: null }

      return {
        count: changes.length,
        content:
          log.refType === "FeatureFlag" ? (
            <SharedChangeLedger
              changes={changes as FlagTargetingReviewChange[]}
              layout="history"
              className="max-h-[32rem] bg-transparent p-0"
              {...flagLedger}
            />
          ) : (
            <ChangeLedger
              changes={changes as ReviewChange[]}
              layout="history"
              className="max-h-[32rem] bg-transparent p-0"
            />
          ),
      }
    },
  }
}
