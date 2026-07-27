import { useTranslation } from "react-i18next"
import { ArrowDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ChangePair } from "@/features/change-review/change-ledger"
import type {
  SegmentCondition,
  SegmentRule,
} from "@/features/segments/segments-types"
import { conditionValues } from "./targeting-utils"

export function RuleChangeLabel({ name }: { name: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Badge variant="outline" className="shrink-0 font-normal">
        {t("targeting.rules.rule")}
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
  const operation = t(`targeting.rules.operators.${condition.op}`, {
    defaultValue: condition.op,
  })
  return `${condition.property} ${operation} ${conditionValues(condition).join(", ")}`.trim()
}

type ConditionChange = {
  id: string
  action: "added" | "removed" | "updated"
  previous?: SegmentCondition
  current?: SegmentCondition
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
      changes.push({ id: condition.id, action: "added", current: condition })
      continue
    }
    const previousText = conditionText(oldCondition, t)
    if (previousText !== currentText) {
      changes.push({
        id: condition.id,
        action: "updated",
        previous: oldCondition,
        current: condition,
      })
    }
  }

  for (const condition of previous.conditions) {
    if (!currentIds.has(condition.id)) {
      changes.push({
        id: condition.id,
        action: "removed",
        previous: condition,
      })
    }
  }

  return changes
}

function ConditionExpression({ condition }: { condition: SegmentCondition }) {
  const { t } = useTranslation()
  const operation = t(`targeting.rules.operators.${condition.op}`, {
    defaultValue: condition.op,
  })
  const unary = condition.op === "IsTrue" || condition.op === "IsFalse"
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="break-words">{condition.property}</span>
      <span className="font-mono font-medium text-muted-foreground">
        {operation}
      </span>
      {unary ? null : (
        <span className="break-words">
          {conditionValues(condition).join(", ")}
        </span>
      )}
    </span>
  )
}

function ConditionPair({
  previous,
  current,
}: {
  previous: SegmentCondition
  current: SegmentCondition
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground">
        <ConditionExpression condition={previous} />
      </p>
      <ArrowDown className="size-3.5 text-muted-foreground" />
      <p>
        <ConditionExpression condition={current} />
      </p>
    </div>
  )
}

function ConditionSummary({ rule }: { rule: SegmentRule }) {
  const { t } = useTranslation()
  if (!rule.conditions.length) return <span>—</span>
  return (
    <div>
      {rule.conditions.map((condition, index) => (
        <div key={condition.id || index}>
          {index > 0 ? (
            <div className="my-2 font-mono text-xs font-medium text-muted-foreground">
              {t("targeting.rules.and")}
            </div>
          ) : null}
          <p>
            <ConditionExpression condition={condition} />
          </p>
        </div>
      ))}
    </div>
  )
}

export function RuleChangeContent({
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
    return (
      <section className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          {t("targeting.review.labels.conditions")}
        </p>
        <ConditionSummary rule={displayedRule} />
      </section>
    )
  }

  const renamed = previous.name !== current.name
  const conditionChanges = changedConditions(previous, current, t)

  return (
    <div className="min-w-0 space-y-3">
      {renamed ? (
        <section className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("targeting.review.labels.name")}
          </p>
          <ChangePair previous={previous.name} current={current.name} />
        </section>
      ) : null}
      {conditionChanges.length ? (
        <section className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("targeting.review.labels.conditions")}
          </p>
          <div>
            {conditionChanges.map((change, index) => (
              <div key={`${change.action}-${change.id}`}>
                {index > 0 ? (
                  <div className="my-2 font-mono text-xs font-medium text-muted-foreground">
                    {t("targeting.rules.and")}
                  </div>
                ) : null}
                {change.action === "updated" ? (
                  <ConditionPair
                    previous={change.previous!}
                    current={change.current!}
                  />
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      {t(`targeting.review.actions.${change.action}`)}
                    </p>
                    <p
                      className={
                        change.action === "removed"
                          ? "break-words text-muted-foreground"
                          : "break-words"
                      }
                    >
                      <ConditionExpression
                        condition={change.current ?? change.previous!}
                      />
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
