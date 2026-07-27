import { Clock3, UserRoundCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ChangeReviewDialog } from "@/features/change-review/change-review-dialog"
import type { FlagTargetingReviewChange } from "./targeting/targeting-utils"
import { useFlagChangeLedgerAdapter } from "./targeting/use-flag-change-ledger-adapter"

export function FlagChangeReviewDialog({
  open,
  flagName,
  changes,
  requireComment,
  saving,
  initialComment,
  scheduleGranted,
  changeRequestGranted,
  onOpenChange,
  onSave,
  onSchedule,
  onChangeRequest,
}: {
  open: boolean
  flagName: string
  changes: FlagTargetingReviewChange[]
  requireComment: boolean
  saving: boolean
  initialComment?: string
  scheduleGranted: boolean
  changeRequestGranted: boolean
  onOpenChange: (open: boolean) => void
  onSave: (comment: string) => void
  onSchedule: (comment: string) => void
  onChangeRequest: (comment: string) => void
}) {
  const { t } = useTranslation()
  const ledger = useFlagChangeLedgerAdapter()
  return (
    <ChangeReviewDialog
      open={open}
      idPrefix="flag-targeting"
      layout="targeting"
      changes={changes}
      requireComment={requireComment}
      saving={saving}
      initialComment={initialComment}
      copy={{
        title: t("featureFlags.detailsPage.review.title"),
        description: t("featureFlags.detailsPage.review.description", {
          name: flagName,
        }),
        changes: t("featureFlags.detailsPage.review.changes"),
        changeCount: (count) =>
          t("featureFlags.detailsPage.review.changeCount", { count }),
        comment: t("featureFlags.detailsPage.review.comment"),
        optional: t("featureFlags.detailsPage.review.optional"),
        commentPlaceholder: t(
          "featureFlags.detailsPage.review.commentPlaceholder"
        ),
        commentHelp: t("featureFlags.detailsPage.review.commentHelp"),
        cancel: t("featureFlags.detailsPage.review.cancel"),
        save: t("featureFlags.detailsPage.review.save"),
        saving: t("featureFlags.detailsPage.review.saving"),
      }}
      ledger={ledger}
      saveOptions={[
        ...(scheduleGranted
          ? [
              {
                label: t("featureFlags.detailsPage.review.schedule"),
                icon: <Clock3 />,
                onSelect: onSchedule,
              },
            ]
          : []),
        ...(changeRequestGranted
          ? [
              {
                label: t("featureFlags.detailsPage.review.requestApproval"),
                icon: <UserRoundCheck />,
                onSelect: onChangeRequest,
              },
            ]
          : []),
      ]}
      saveOptionsLabel={t("featureFlags.detailsPage.review.moreSaveOptions")}
      saveImmediatelyDescription={t(
        "featureFlags.detailsPage.review.applyImmediately"
      )}
      onOpenChange={onOpenChange}
      onSave={onSave}
    />
  )
}
