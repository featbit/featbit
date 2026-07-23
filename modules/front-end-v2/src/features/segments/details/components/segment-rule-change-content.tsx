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

export function SegmentRuleChangeContent({
  previous,
  current,
}: {
  previous?: SegmentRule
  current?: SegmentRule
}) {
  const { t } = useTranslation()
  const displayedRule = current ?? previous
  if (!displayedRule?.conditions.length) return <span>—</span>

  const previousById = new Map(
    previous?.conditions.map((condition) => [condition.id, condition]) ?? []
  )
  const currentIds = new Set(
    current?.conditions.map((condition) => condition.id) ?? []
  )

  return (
    <div className="min-w-0">
      {previous && current && previous.name !== current.name ? (
        <div className="mb-2">
          <ChangePair previous={previous.name} current={current.name} />
        </div>
      ) : null}
      {(current ?? previous)?.conditions.map((condition, index) => {
        const oldCondition = previousById.get(condition.id)
        const oldText = oldCondition ? conditionText(oldCondition, t) : ""
        const newText = conditionText(condition, t)
        return (
          <div key={condition.id || index}>
            {index > 0 ? (
              <div className="py-1 font-mono text-[0.7rem] font-semibold text-muted-foreground">
                {t("segments.detailsPage.rules.and")}
              </div>
            ) : null}
            {oldCondition && oldText !== newText ? (
              <ChangePair previous={oldText} current={newText} />
            ) : (
              <p className="break-words">{newText}</p>
            )}
          </div>
        )
      })}
      {previous && current
        ? previous.conditions
            .filter((condition) => !currentIds.has(condition.id))
            .map((condition) => (
              <div key={condition.id} className="mt-2">
                <ChangePair
                  previous={conditionText(condition, t)}
                  current="—"
                />
              </div>
            ))
        : null}
    </div>
  )
}
