import { Clock3, UserRoundCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ChangeReviewDialog } from "@/features/change-review/change-review-dialog"
import {
  FlagChangeBadgeLabel,
  FlagDefaultChangeContent,
  FlagRuleChangeContent,
  FlagRuleChangeLabel,
} from "./targeting/flag-rule-change-content"
import type { FlagTargetingReviewChange } from "./targeting/targeting-utils"

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
      ledger={{
        copy: {
          label: (change) => change.label,
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
        renderLabel: (change) => {
          if (change.kind === "rule")
            return <FlagRuleChangeLabel name={change.label} />
          if (change.kind === "targeting")
            return (
              <FlagChangeBadgeLabel
                badge={t("featureFlags.detailsPage.review.user")}
                name={change.label}
              />
            )
          if (change.kind === "default")
            return (
              <FlagChangeBadgeLabel
                badge={t("featureFlags.detailsPage.review.default")}
                name={change.label}
              />
            )
          return undefined
        },
        renderContent: (change) => {
          if (change.kind === "rule")
            return (
              <FlagRuleChangeContent
                previousRule={change.previousRule}
                currentRule={change.currentRule}
                previousServing={change.previousServing}
                currentServing={change.currentServing}
              />
            )
          if (change.kind === "default")
            return (
              <FlagDefaultChangeContent
                previous={change.previousServing}
                current={change.currentServing}
              />
            )
          return undefined
        },
      }}
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
