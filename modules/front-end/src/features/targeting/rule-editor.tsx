import { useState } from "react"
import {
  isMultiValueOperator,
  isSemVerOperator,
  isValidSemVerCondition,
  semVerOperators,
} from "./semver"
import { GripVertical, Plus, Trash2, X } from "lucide-react"
import type { DragEvent, KeyboardEvent, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
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
import { MultiValuePicker } from "./multi-value-picker"

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
  const [pendingOperator, setPendingOperator] = useState<{
    id: string
    op: string
  } | null>(null)
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
          const property = properties.find(
            (candidate) => candidate.name === condition.property
          )
          const multiValue = isMultiValueOperator(condition.op)
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
                              : withConditionValues({ ...item, property }, [])
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
                        const semVerTransition =
                          isSemVerOperator(op) || isSemVerOperator(condition.op)
                        if (
                          semVerTransition &&
                          !isMultiValueOperator(op) &&
                          values.length > 1
                        ) {
                          setPendingOperator({ id: condition.id, op })
                          return
                        }
                        setPendingOperator(null)
                        const nextValues = semVerTransition
                          ? values.filter((value) => value !== "")
                          : isMultiValueOperator(op)
                            ? []
                            : op === "IsTrue" || op === "IsFalse"
                              ? [op]
                              : [""]
                        onChange({
                          ...rule,
                          conditions: rule.conditions.map((item) =>
                            item.id === condition.id
                              ? withConditionValues({ ...item, op }, nextValues)
                              : item
                          ),
                        })
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={t("targeting.rules.selectOperator")}
                      >
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
                        <SelectGroup>
                          <SelectLabel>
                            {t("targeting.rules.semVerGroup")}
                          </SelectLabel>
                          {semVerOperators.map((operator) => (
                            <SelectItem key={operator} value={operator}>
                              {t(`targeting.rules.operators.${operator}`)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <div className="min-w-0 space-y-1">
                      {multiValue ? (
                        <MultiValuePicker
                          key={`${condition.property}-${isSemVerOperator(condition.op)}`}
                          semanticVersion={isSemVerOperator(condition.op)}
                          values={values}
                          presetValues={property?.presetValues ?? []}
                          presetOnly={property?.usePresetValuesOnly ?? false}
                          disabled={disabled}
                          onChange={(nextValues) =>
                            onChange({
                              ...rule,
                              conditions: rule.conditions.map((item) =>
                                item.id === condition.id
                                  ? withConditionValues(item, nextValues)
                                  : item
                              ),
                            })
                          }
                        />
                      ) : (
                        <Input
                          value={valueDisabled ? "" : values.join(", ")}
                          disabled={disabled || valueDisabled}
                          placeholder={
                            isSemVerOperator(condition.op)
                              ? "2.3.0"
                              : t("targeting.rules.value")
                          }
                          aria-invalid={!isValidSemVerCondition(condition)}
                          onChange={(event) =>
                            onChange({
                              ...rule,
                              conditions: rule.conditions.map((item) =>
                                item.id === condition.id
                                  ? withConditionValues(item, [
                                      event.target.value,
                                    ])
                                  : item
                              ),
                            })
                          }
                        />
                      )}
                      {isSemVerOperator(condition.op) && (
                        <p
                          className={
                            isValidSemVerCondition(condition)
                              ? "text-xs text-muted-foreground"
                              : "text-xs text-destructive"
                          }
                        >
                          {t(
                            isValidSemVerCondition(condition)
                              ? "targeting.rules.semVerHelp"
                              : "targeting.rules.semVerInvalid"
                          )}
                        </p>
                      )}
                      {pendingOperator?.id === condition.id && (
                        <div className="space-y-1 text-xs">
                          <p>{t("targeting.rules.semVerChoose")}</p>
                          {values.map((value) => (
                            <Button
                              key={value}
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={disabled}
                              onClick={() => {
                                onChange({
                                  ...rule,
                                  conditions: rule.conditions.map((item) =>
                                    item.id === condition.id
                                      ? withConditionValues(
                                          { ...item, op: pendingOperator.op },
                                          [value]
                                        )
                                      : item
                                  ),
                                })
                                setPendingOperator(null)
                              }}
                            >
                              {value}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setPendingOperator(null)}
                          >
                            {t("targeting.rules.cancelSwitch")}
                          </Button>
                        </div>
                      )}
                    </div>
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
