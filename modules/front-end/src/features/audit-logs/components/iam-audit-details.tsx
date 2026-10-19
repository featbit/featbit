import { useTranslation } from "react-i18next"
import { ChangeLedger } from "@/features/change-review/change-ledger"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import { iamChanges } from "../iam-audit-changes"
import type { AuditLog } from "../audit-logs-types"

export function IamAuditDetails({ log }: { log: AuditLog }) {
  const { t } = useTranslation()
  const changes: ChangeReviewItem[] = iamChanges(log).map((change) => ({
    kind: change.field,
    label: change.label ?? "",
    action: !change.before ? "added" : !change.after ? "removed" : "updated",
    previous: change.before || undefined,
    current: change.after || undefined,
  }))
  return (
    <div className="space-y-3">
      {log.source ? (
        <p className="text-sm text-muted-foreground">
          {t("auditLogs.clonedFrom")}:{" "}
          <span className="font-mono">{log.source}</span>
        </p>
      ) : null}
      <ChangeLedger
        changes={changes}
        layout="history"
        className="max-h-[32rem] bg-transparent p-0 whitespace-pre-wrap"
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
    </div>
  )
}
