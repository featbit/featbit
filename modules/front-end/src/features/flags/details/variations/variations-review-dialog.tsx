import { Trans, useTranslation } from "react-i18next"
import { ChangeReviewDialog } from "@/features/change-review/change-review-dialog"
import type { VariationReviewChange } from "./variations-utils"

export function VariationsReviewDialog({
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
  changes: VariationReviewChange[]
  requireComment: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (comment: string) => void
}) {
  const { t } = useTranslation()
  return (
    <ChangeReviewDialog
      open={open}
      idPrefix="flag-variations"
      layout="settings"
      changes={changes}
      requireComment={requireComment}
      saving={saving}
      copy={{
        title: t("featureFlags.detailsPage.variations.reviewTitle"),
        description: (
          <Trans
            i18nKey="featureFlags.detailsPage.variations.reviewDescription"
            values={{ name: flagName }}
            components={{
              strong: <strong className="font-semibold text-foreground" />,
            }}
          />
        ),
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
            change.label === "order"
              ? t("featureFlags.detailsPage.variations.order")
              : change.label,
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
