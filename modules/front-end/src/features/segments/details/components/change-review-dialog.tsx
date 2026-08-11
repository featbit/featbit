import { Trans, useTranslation } from "react-i18next"
import { ChangeReviewDialog as SharedChangeReviewDialog } from "@/features/change-review/change-review-dialog"
import type { ReviewChange } from "../segment-details-utils"
import { useSegmentChangeLedgerAdapter } from "./segment-change-ledger-adapter"

type Props = {
  open: boolean
  kind: "targeting" | "settings"
  segmentName: string
  changes: ReviewChange[]
  requireComment: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (comment: string) => void
}

export function ChangeReviewDialog({
  open,
  kind,
  segmentName,
  changes,
  requireComment,
  saving,
  onOpenChange,
  onSave,
}: Props) {
  const { t } = useTranslation()
  const ledger = useSegmentChangeLedgerAdapter()

  return (
    <SharedChangeReviewDialog
      open={open}
      idPrefix={`segment-${kind}`}
      layout={kind}
      changes={changes}
      requireComment={requireComment}
      saving={saving}
      copy={{
        title: t(`segments.detailsPage.review.${kind}.title`),
        description: (
          <Trans
            i18nKey="segments.detailsPage.review.description"
            values={{ name: segmentName }}
            components={{
              strong: <strong className="font-semibold text-foreground" />,
            }}
          />
        ),
        changes: t("segments.detailsPage.review.changes"),
        changeCount: (count) =>
          t("segments.detailsPage.review.changeCount", { count }),
        comment: t("segments.detailsPage.review.comment"),
        optional: t("segments.detailsPage.optional"),
        commentPlaceholder: t("segments.confirm.commentPlaceholder"),
        commentHelp: t("segments.detailsPage.review.commentHelp"),
        cancel: t("segments.confirm.cancel"),
        save: t("segments.detailsPage.review.save"),
        saving: t("segments.detailsPage.review.saving"),
      }}
      ledger={ledger}
      onOpenChange={onOpenChange}
      onSave={onSave}
    />
  )
}
