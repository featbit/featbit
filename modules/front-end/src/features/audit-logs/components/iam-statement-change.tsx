import { useTranslation } from "react-i18next"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ChangeLedger } from "@/features/change-review/change-ledger"
import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import { permissionActionFallback } from "@/features/iam/team/details/permissions-model"
import type { IamStatementChange } from "../iam-audit-changes"

export function IamStatementChangeDetails({
  change,
}: {
  change: IamStatementChange
}) {
  const { t } = useTranslation()
  const snapshot = change.action !== "updated"
  const fields: ChangeReviewItem[] = []
  for (const kind of [
    "resourceType",
    "effect",
    "resources",
    "actions",
  ] as const) {
    if (kind === "resources" || kind === "actions") {
      const before = [...new Set(change.previous?.[kind] ?? [])].sort()
      const after = [...new Set(change.current?.[kind] ?? [])].sort()
      if (snapshot) {
        const values = change.current ? after : before
        fields.push({
          kind,
          label: "",
          values,
          current: values.length ? undefined : "—",
        })
      } else {
        const removed = before.filter((value) => !after.includes(value))
        const added = after.filter((value) => !before.includes(value))
        if (removed.length || added.length)
          fields.push({
            kind,
            label: "",
            valueGroups: [
              ...(removed.length
                ? [{ action: "removed" as const, values: removed }]
                : []),
              ...(added.length
                ? [{ action: "added" as const, values: added }]
                : []),
            ],
          })
      }
    } else {
      const previous = change.previous?.[kind] ?? ""
      const current = change.current?.[kind] ?? ""
      const label = (value: string) =>
        !value
          ? "—"
          : kind === "resourceType"
            ? t(
                `iam.policies.details.permissionsEditor.resourceTypes.${value}`,
                { defaultValue: value }
              )
            : t(`iam.team.details.${value}`, { defaultValue: value })
      if (snapshot)
        fields.push({
          kind,
          label: "",
          current: label(change.current ? current : previous),
        })
      else if (previous !== current)
        fields.push({
          kind,
          label: "",
          action: "updated",
          previous: label(previous),
          current: label(current),
        })
    }
  }
  return (
    <section className="space-y-2 pt-1.5">
      <div className="flex items-center gap-3 px-2">
        <h4 className="text-[13px] font-semibold">
          {t("auditLogs.permissionStatement", { number: change.number })}
        </h4>
        <span className="text-xs text-muted-foreground">
          {t(`featureFlags.detailsPage.review.${change.action}`)}
        </span>
      </div>
      <ChangeLedger
        changes={fields}
        layout="history"
        snapshot={snapshot}
        className="max-h-none bg-transparent p-0"
        copy={{
          label: (field) => t(`auditLogs.iamFields.${field.kind}`),
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
        renderValue={(value, field) =>
          field.kind === "actions" ? (
            <Tooltip>
              <TooltipTrigger render={<span className="break-words" />}>
                {t(
                  `iam.policies.details.permissionsEditor.actionLabels.${value}`,
                  { defaultValue: permissionActionFallback(value) }
                )}
              </TooltipTrigger>
              <TooltipContent>{value}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="font-mono text-xs break-all">{value}</span>
          )
        }
      />
    </section>
  )
}
