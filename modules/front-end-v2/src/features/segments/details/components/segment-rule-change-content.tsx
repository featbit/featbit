import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ChangePair } from "@/features/change-review/change-ledger"
import type { SegmentCondition, SegmentRule } from "../../segments-types"
import { conditionValues } from "../segment-details-utils"

export function SegmentRuleChangeLabel({ name }: { name: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Badge variant="outline" className="shrink-0 font-normal">
        {t("segments.detailsPage.rules.rule")}
      </Badge>
      <Tooltip>
        <TooltipTrigger
          render={<span className="min-w-0 truncate align-middle" />}
        >
          {name}
        </TooltipTrigger>
        <TooltipContent>{name}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function conditionText(
  condition: SegmentCondition,
  t: ReturnType<typeof useTranslation>["t"]
) {
  const operation = t(`segments.detailsPage.rules.operators.${condition.op}`, {
    defaultValue: condition.op,
  })
  return `${condition.property} ${operation} ${conditionValues(condition).join(", ")}`.trim()
}

type ConditionChange = {
  id: string
  action: "added" | "removed" | "updated"
  previous?: string
  current?: string
}

function changedConditions(
  previous: SegmentRule,
  current: SegmentRule,
  t: ReturnType<typeof useTranslation>["t"]
): ConditionChange[] {
  const previousById = new Map(
    previous.conditions.map((condition) => [condition.id, condition])
  )
  const currentIds = new Set(
    current.conditions.map((condition) => condition.id)
  )
  const changes: ConditionChange[] = []

  for (const condition of current.conditions) {
    const oldCondition = previousById.get(condition.id)
    const currentText = conditionText(condition, t)
    if (!oldCondition) {
      changes.push({ id: condition.id, action: "added", current: currentText })
      continue
    }
    const previousText = conditionText(oldCondition, t)
    if (previousText !== currentText) {
      changes.push({
        id: condition.id,
        action: "updated",
        previous: previousText,
        current: currentText,
      })
    }
  }

  for (const condition of previous.conditions) {
    if (!currentIds.has(condition.id)) {
      changes.push({
        id: condition.id,
        action: "removed",
        previous: conditionText(condition, t),
      })
    }
  }

  return changes
}

function ConditionSummary({ rule }: { rule: SegmentRule }) {
  const { t } = useTranslation()
  if (!rule.conditions.length) return <span>—</span>
  return (
    <div>
      {rule.conditions.map((condition, index) => (
        <div key={condition.id || index}>
          {index > 0 ? (
            <div className="my-2 text-xs font-medium text-muted-foreground">
              {t("segments.detailsPage.rules.and")}
            </div>
          ) : null}
          <p className="break-words">{conditionText(condition, t)}</p>
        </div>
      ))}
    </div>
  )
}

export function SegmentRuleChangeContent({
  previous,
  current,
}: {
  previous?: SegmentRule
  current?: SegmentRule
}) {
  const { t } = useTranslation()
  const displayedRule = current ?? previous
  if (!displayedRule) return <span>—</span>

  if (!previous || !current) {
    return <ConditionSummary rule={displayedRule} />
  }

  const renamed = previous.name !== current.name
  const conditionChanges = changedConditions(previous, current, t)

  return (
    <div className="min-w-0 space-y-3">
      {renamed ? (
        <section className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("segments.detailsPage.review.labels.name")}
          </p>
          <ChangePair previous={previous.name} current={current.name} />
        </section>
      ) : null}
      {conditionChanges.length ? (
        <section className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("segments.detailsPage.review.labels.conditions")}
          </p>
          <div>
            {conditionChanges.map((change, index) => (
              <div key={`${change.action}-${change.id}`}>
                {index > 0 ? (
                  <div className="my-2 text-xs font-medium text-muted-foreground">
                    {t("segments.detailsPage.rules.and")}
                  </div>
                ) : null}
                {change.action === "updated" ? (
                  <ChangePair
                    previous={change.previous ?? ""}
                    current={change.current ?? ""}
                  />
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      {t(
                        `segments.detailsPage.review.actions.${change.action}`
                      )}
                    </p>
                    <p
                      className={
                        change.action === "removed"
                          ? "break-words text-muted-foreground"
                          : "break-words"
                      }
                    >
                      {change.current ?? change.previous}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
