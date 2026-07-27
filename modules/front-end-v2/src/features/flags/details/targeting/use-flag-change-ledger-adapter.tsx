import { useTranslation } from "react-i18next"
import {
  FlagChangeBadgeLabel,
  FlagDefaultChangeContent,
  FlagRuleChangeContent,
  FlagRuleChangeLabel,
} from "./flag-rule-change-content"
import type { FlagTargetingReviewChange } from "./targeting-utils"

export function useFlagChangeLedgerAdapter() {
  const { t } = useTranslation()
  return {
    copy: {
      label: (change: FlagTargetingReviewChange) => change.label,
      action: (action: NonNullable<FlagTargetingReviewChange["action"]>) =>
        t(`featureFlags.detailsPage.review.${action}`),
      actionCount: (
        action: Extract<
          NonNullable<FlagTargetingReviewChange["action"]>,
          "added" | "removed"
        >,
        count: number
      ) =>
        t("featureFlags.detailsPage.review.actionCount", {
          action: t(`featureFlags.detailsPage.review.${action}`),
          count,
        }),
      showMore: (count: number) =>
        t("featureFlags.detailsPage.review.showMore", { count }),
      showLess: t("featureFlags.detailsPage.review.showLess"),
    },
    renderLabel: (change: FlagTargetingReviewChange) => {
      if (change.kind === "rule") {
        return <FlagRuleChangeLabel name={change.label} />
      }
      if (change.kind === "targeting") {
        return (
          <FlagChangeBadgeLabel
            badge={t("featureFlags.detailsPage.review.user")}
            name={change.label}
          />
        )
      }
      if (change.kind === "default") {
        return (
          <FlagChangeBadgeLabel
            badge={t("featureFlags.detailsPage.review.default")}
            name={change.label}
          />
        )
      }
      return undefined
    },
    renderContent: (change: FlagTargetingReviewChange) => {
      if (change.kind === "rule") {
        return (
          <FlagRuleChangeContent
            previousRule={change.previousRule}
            currentRule={change.currentRule}
            previousServing={change.previousServing}
            currentServing={change.currentServing}
          />
        )
      }
      if (change.kind === "default") {
        return (
          <FlagDefaultChangeContent
            previous={change.previousServing}
            current={change.currentServing}
          />
        )
      }
      return undefined
    },
  }
}
