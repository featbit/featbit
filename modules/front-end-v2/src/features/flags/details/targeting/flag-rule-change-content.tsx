import { ArrowDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  SegmentRuleChangeContent,
  SegmentRuleChangeLabel,
} from "@/features/segments/details/components/segment-rule-change-content"
import type { FlagRule } from "../../flags-types"
import type { FlagServingReview } from "./targeting-utils"

function stableRuleDefinition(rule: FlagRule) {
  return JSON.stringify({
    name: rule.name,
    conditions: rule.conditions.map((condition) => ({
      id: condition.id,
      property: condition.property,
      op: condition.op,
      value: condition.value,
    })),
  })
}

export function FlagRuleChangeLabel({ name }: { name: string }) {
  return <SegmentRuleChangeLabel name={name} />
}

export function FlagChangeBadgeLabel({
  badge,
  name,
}: {
  badge: string
  name: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Badge variant="outline" className="shrink-0 font-normal">
        {badge}
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

function FlagServeValue({
  value,
  zh,
  previous = false,
}: {
  value?: FlagServingReview
  zh: boolean
  previous?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
      {value?.variations.length ? (
        value.variations.map((variation) => (
          <span key={variation.id} className="inline-flex items-center gap-1.5">
            <span
              className={
                previous
                  ? "font-normal text-muted-foreground"
                  : "font-normal text-foreground"
              }
            >
              {variation.name}
            </span>
            {variation.percentage === undefined ? null : (
              <span className="text-muted-foreground">
                {variation.percentage}%
              </span>
            )}
          </span>
        ))
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      {value?.dispatchKey ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span>{zh ? "基于属性" : "Dispatch by"}</span>
          <span className={previous ? undefined : "text-foreground"}>
            {value.dispatchKey}
          </span>
        </span>
      ) : null}
    </div>
  )
}

function FlagServeChange({
  previous,
  current,
  zh,
}: {
  previous?: FlagServingReview
  current?: FlagServingReview
  zh: boolean
}) {
  return (
    <section className="space-y-1.5">
      <p className="font-mono text-xs font-medium text-muted-foreground">
        {zh ? "返回" : "Serve"}
      </p>
      {!previous ? (
        <FlagServeValue value={current} zh={zh} />
      ) : !current ? (
        <FlagServeValue value={previous} zh={zh} previous />
      ) : (
        <div className="space-y-1">
          <FlagServeValue value={previous} zh={zh} previous />
          <ArrowDown className="size-3.5 text-muted-foreground" />
          <FlagServeValue value={current} zh={zh} />
        </div>
      )}
    </section>
  )
}

export function FlagDefaultChangeContent({
  previous,
  current,
  zh,
}: {
  previous?: FlagServingReview
  current?: FlagServingReview
  zh: boolean
}) {
  return <FlagServeChange previous={previous} current={current} zh={zh} />
}

export function FlagRuleChangeContent({
  previousRule,
  currentRule,
  previousServing,
  currentServing,
  zh,
}: {
  previousRule?: FlagRule
  currentRule?: FlagRule
  previousServing?: FlagServingReview
  currentServing?: FlagServingReview
  zh: boolean
}) {
  const definitionChanged =
    !previousRule ||
    !currentRule ||
    stableRuleDefinition(previousRule) !== stableRuleDefinition(currentRule)
  const servingChanged =
    !previousRule ||
    !currentRule ||
    JSON.stringify(previousServing) !== JSON.stringify(currentServing)

  return (
    <div className="min-w-0 space-y-3">
      {definitionChanged ? (
        <SegmentRuleChangeContent
          previous={previousRule}
          current={currentRule}
        />
      ) : null}
      {servingChanged ? (
        <FlagServeChange
          previous={previousServing}
          current={currentServing}
          zh={zh}
        />
      ) : null}
    </div>
  )
}
