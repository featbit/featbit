import { GripVertical, Plus, Trash2, X } from "lucide-react"
import type { DragEvent, KeyboardEvent, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  SegmentRule,
  SegmentUserProperty,
} from "@/features/segments/segments-types"
import {
  conditionValues,
  newTargetingId,
  withConditionValues,
} from "./targeting-utils"
import { PropertyPicker } from "./property-picker"
import { SegmentConditionPicker } from "./segment-condition-picker"
import { isSegmentConditionProperty } from "./segment-conditions"

const operators = [
  "Equal",
  "NotEqual",
  "LessThan",
  "LessEqualThan",
  "BiggerThan",
  "BiggerEqualThan",
  "IsOneOf",
  "NotOneOf",
  "Contains",
  "NotContain",
  "StartsWith",
  "EndsWith",
  "MatchRegex",
  "NotMatchRegex",
  "IsTrue",
  "IsFalse",
] as const

export function RuleEditor({
  envId,
  rule,
  properties,
  includeSegmentConditions = false,
  disabled,
  canMoveUp,
  canMoveDown,
  onDragStart,
  onDrag,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onChange,
  onRemove,
  footer,
}: {
  envId: string
  rule: SegmentRule
  properties: SegmentUserProperty[]
  includeSegmentConditions?: boolean
  disabled: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDrag: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onChange: (rule: SegmentRule) => void
  onRemove: () => void
  footer?: ReactNode
}) {
  const { t } = useTranslation()
  function handleReorderKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp" && canMoveUp) {
      event.preventDefault()
      onMoveUp()
    }
    if (event.key === "ArrowDown" && canMoveDown) {
      event.preventDefault()
      onMoveDown()
    }
  }

  return (
    <article className="rounded-md border">
      <div className="flex items-center gap-3 border-b px-3 py-2">
        <button
          type="button"
          draggable={!disabled}
          disabled={disabled}
          aria-label={t("targeting.rules.reorder", {
            rule: rule.name,
          })}
          className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          onKeyDown={handleReorderKeyDown}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <Input
          value={rule.name}
          disabled={disabled}
          className="h-8 max-w-sm"
          aria-label={t("targeting.rules.name")}
          onChange={(event) => onChange({ ...rule, name: event.target.value })}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
        >
          <span className="inline-flex items-center gap-1 leading-none">
            <Trash2 className="size-3.5 -translate-y-px" />
            <span>{t("targeting.rules.remove")}</span>
          </span>
        </Button>
      </div>
      <div className="space-y-2 px-4 py-3">
        {rule.conditions.map((condition, index) => {
          const segmentCondition = isSegmentConditionProperty(
            condition.property
          )
          const values = conditionValues(condition)
          const valueDisabled =
            condition.op === "IsTrue" || condition.op === "IsFalse"
          return (
            <div
              key={condition.id}
              className="grid grid-cols-[1.75rem_minmax(10rem,1fr)_minmax(10rem,.9fr)_minmax(14rem,2fr)_2rem] gap-3"
            >
              <span className="flex h-8 items-center text-xs font-medium text-muted-foreground">
                {t(index === 0 ? "targeting.rules.if" : "targeting.rules.and")}
              </span>
              <div className="contents">
                <PropertyPicker
                  envId={envId}
                  value={condition.property}
                  disabled={disabled}
                  properties={properties}
                  includeSegmentConditions={includeSegmentConditions}
                  onValueChange={(property) => {
                    onChange({
                      ...rule,
                      conditions: rule.conditions.map((item) =>
                        item.id === condition.id
                          ? isSegmentConditionProperty(property)
                            ? { ...item, property, op: "", value: "[]" }
                            : segmentCondition
                              ? {
                                  ...item,
                                  property,
                                  op: "Equal",
                                  value: "",
                                }
                              : { ...item, property }
                          : item
                      ),
                    })
                  }}
                />
                {segmentCondition ? (
                  <div className="col-span-2">
                    <SegmentConditionPicker
                      envId={envId}
                      value={condition.value}
                      disabled={disabled}
                      onValueChange={(value) =>
                        onChange({
                          ...rule,
                          conditions: rule.conditions.map((item) =>
                            item.id === condition.id ? { ...item, value } : item
                          ),
                        })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <Select
                      value={condition.op}
                      disabled={disabled}
                      onValueChange={(op) => {
                        if (!op) return
                        onChange({
                          ...rule,
                          conditions: rule.conditions.map((item) =>
                            item.id === condition.id
                              ? withConditionValues({ ...item, op }, values)
                              : item
                          ),
                        })
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {t(`targeting.rules.operators.${condition.op}`)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {operators.map((operator) => (
                            <SelectItem key={operator} value={operator}>
                              {t(`targeting.rules.operators.${operator}`)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Input
                      value={valueDisabled ? "" : values.join(", ")}
                      disabled={disabled || valueDisabled}
                      placeholder={
                        condition.op === "IsOneOf" ||
                        condition.op === "NotOneOf"
                          ? t("targeting.rules.multiValue")
                          : t("targeting.rules.value")
                      }
                      onChange={(event) =>
                        onChange({
                          ...rule,
                          conditions: rule.conditions.map((item) =>
                            item.id === condition.id
                              ? withConditionValues(
                                  item,
                                  condition.op === "IsOneOf" ||
                                    condition.op === "NotOneOf"
                                    ? event.target.value
                                        .split(",")
                                        .map((value) => value.trim())
                                        .filter(Boolean)
                                    : [event.target.value]
                                )
                              : item
                          ),
                        })
                      }
                    />
                  </>
                )}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={t("targeting.rules.removeCondition")}
                  onClick={() =>
                    onChange({
                      ...rule,
                      conditions: rule.conditions.filter(
                        (item) => item.id !== condition.id
                      ),
                    })
                  }
                >
                  <X />
                </Button>
              </div>
            </div>
          )
        })}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          disabled={disabled}
          onClick={() =>
            onChange({
              ...rule,
              conditions: [
                ...rule.conditions,
                {
                  id: newTargetingId(),
                  property: "keyId",
                  op: "Equal",
                  value: "",
                },
              ],
            })
          }
        >
          <span className="inline-flex items-center gap-1 leading-none">
            <Plus className="size-3.5 -translate-y-px" />
            <span>{t("targeting.rules.addCondition")}</span>
          </span>
        </Button>
        {footer}
      </div>
    </article>
  )
}
