import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChangeLedger as SharedChangeLedger } from "@/features/change-review/change-ledger"
import { useFlagChangeLedgerAdapter } from "@/features/flags/details/targeting/use-flag-change-ledger-adapter"
import type { FlagTargetingReviewChange } from "@/features/flags/details/targeting/targeting-utils"
import { ChangeLedger } from "@/features/segments/details/components/change-ledger"
import type { ReviewChange } from "@/features/segments/details/segment-details-utils"
import {
  auditEventFragments,
  auditEventTitle,
  auditHistoryChanges,
} from "../audit-log-utils"
import type { AuditLog } from "../audit-logs-types"

export type AuditLogChangeDetails = {
  count: number
  content: ReactNode
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
