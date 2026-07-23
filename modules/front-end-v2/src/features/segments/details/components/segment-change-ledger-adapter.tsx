import { useTranslation } from "react-i18next"
import type { ReviewChange } from "../segment-details-utils"
import {
  SegmentRuleChangeContent,
  SegmentRuleChangeLabel,
} from "./segment-rule-change-content"

export function useSegmentChangeLedgerAdapter() {
  const { t } = useTranslation()
  return {
    copy: {
      label: (change: ReviewChange) =>
        change.literalLabel
          ? change.label
          : t(`segments.detailsPage.review.labels.${change.label}`, {
              defaultValue: change.label,
            }),
      action: (action: NonNullable<ReviewChange["action"]>) =>
        t(`segments.detailsPage.review.actions.${action}`),
      actionCount: (
        action: Extract<
          NonNullable<ReviewChange["action"]>,
          "added" | "removed"
        >,
        count: number
      ) => t(`segments.detailsPage.review.actions.${action}Count`, { count }),
      showMore: (count: number) =>
        t("segments.detailsPage.review.showMore", { count }),
      showLess: t("segments.detailsPage.review.showLess"),
    },
    renderLabel: (change: ReviewChange) =>
      change.kind === "rule" || change.kind === "ruleSummary" ? (
        <SegmentRuleChangeLabel name={change.label} />
      ) : undefined,
    renderContent: (change: ReviewChange) =>
      change.kind === "rule" ? (
        <SegmentRuleChangeContent
          previous={change.previousRule}
          current={change.currentRule}
        />
      ) : undefined,
  }
}
