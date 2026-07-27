import { useTranslation } from "react-i18next"
import { ChangeReviewDialog } from "@/features/change-review/change-review-dialog"
import type { FlagSettingsReviewChange } from "./settings-utils"

export function SettingsReviewDialog({
  open,
  flagName,
  changes,
  requireComment,
  saving,
  onOpenChange,
  onSave,
}: {
  open: boolean
  flagName: string
  changes: FlagSettingsReviewChange[]
  requireComment: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (comment: string) => void
}) {
  const { t } = useTranslation()
  return (
    <ChangeReviewDialog
      open={open}
      idPrefix="flag-settings"
      layout="settings"
      changes={changes}
      requireComment={requireComment}
      saving={saving}
      copy={{
        title: t("featureFlags.detailsPage.settings.reviewTitle"),
        description: t("featureFlags.detailsPage.settings.reviewDescription", {
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
      ledger={{
        copy: {
          label: (change) =>
            t(`featureFlags.detailsPage.settings.fields.${change.label}`),
          action: (action) => t(`featureFlags.detailsPage.review.${action}`),
          actionCount: (action, count) =>
            t("featureFlags.detailsPage.review.actionCount", {
              action: t(`featureFlags.detailsPage.review.${action}`),
              count,
            }),
          showMore: (count) =>
            t("featureFlags.detailsPage.review.showMore", { count }),
          showLess: t("featureFlags.detailsPage.review.showLess"),
        },
      }}
      onOpenChange={onOpenChange}
      onSave={onSave}
    />
  )
}
