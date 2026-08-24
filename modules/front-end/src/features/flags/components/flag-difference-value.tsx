import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Lang } from "@/features/layout/layout-types"
import { isSegmentConditionProperty } from "@/features/targeting/segment-conditions"
import { ChevronRight } from "lucide-react"
import type {
  FlagComparisonRule,
  FlagComparisonValue,
  FlagSettingCopyMode,
} from "../flags-types"

export type FlagDifferenceKey =
  | "onOffState"
  | "individualTargeting"
  | "targetingRule"
  | "defaultRule"
  | "offVariation"

const MAX_VISIBLE_TARGET_USERS = 10
const UNARY_RULE_OPERATORS = new Set(["IsTrue", "IsFalse"])

function variationLabel(flag: FlagComparisonValue, variationId: string) {
  const variation = flag.variations.find((item) => item.id === variationId)
  return variation?.name || variation?.value || variationId
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string" || typeof value === "number")
    return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  if (Array.isArray(value)) return value.map(scalar).join(", ")
  return JSON.stringify(value)
}

function conditionValue(
  property: string,
  value: unknown,
  segmentNames?: ReadonlyMap<string, string>
) {
  if (!isSegmentConditionProperty(property)) return scalar(value)

  let segmentIds: string[]
  if (Array.isArray(value)) {
    segmentIds = value.map(String)
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      segmentIds = Array.isArray(parsed) ? parsed.map(String) : [value]
    } catch {
      segmentIds = value ? [value] : []
    }
  } else {
    segmentIds = value === null || value === undefined ? [] : [String(value)]
  }

  return segmentIds.map((id) => segmentNames?.get(id) ?? id).join(", ")
}

function SyntaxKeyword({ children }: { children: string }) {
  return (
    <span className="inline-flex w-10 shrink-0 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function DispatchKeyValue({
  dispatchKey,
}: {
  dispatchKey: unknown
  lang: Lang
}) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span>{t("featureFlags.differenceValue.dispatchBy")}</span>
      <span data-testid="dispatch-key" className="font-normal text-foreground">
        {scalar(dispatchKey)}
      </span>
    </span>
  )
}

function VariationPercentage({
  percentage,
  testId,
}: {
  percentage: number
  testId: string
}) {
  return (
    <span data-testid={testId} className="text-xs text-muted-foreground">
      {percentage}%
    </span>
  )
}

function RuleServeValue({
  rule,
  flag,
  lang,
}: {
  rule: FlagComparisonRule
  flag: FlagComparisonValue
  lang: Lang
}) {
  const { t } = useTranslation()
  const variations = rule.variations ?? []
  if (!variations.length) return null
  const showPercentage = variations.length > 1

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SyntaxKeyword>{t("featureFlags.differenceValue.serve")}</SyntaxKeyword>
      {variations.map((item, index) => {
        const variationId = scalar(item.id ?? item.variationId)
        const label = variationLabel(flag, variationId)
        const rollout = item.rollout
        const percentage =
          showPercentage && Array.isArray(rollout)
            ? Math.round(Number(rollout[1] ?? 0) * 100)
            : null
        return (
          <span
            key={`${variationId}-${index}`}
            className="inline-flex items-center gap-1.5"
          >
            <span
              data-testid="rule-variation-name"
              className="text-xs font-normal text-foreground"
            >
              {label}
            </span>
            {percentage !== null ? (
              <VariationPercentage
                percentage={percentage}
                testId="targeting-variation-percentage"
              />
            ) : null}
          </span>
        )
      })}
      {showPercentage ? (
        <DispatchKeyValue dispatchKey={rule.dispatchKey} lang={lang} />
      ) : null}
    </div>
  )
}

function RulesValue({
  flag,
  startAt = 0,
  lang,
  segmentNames,
}: {
  flag: FlagComparisonValue
  startAt?: number
  lang: Lang
  segmentNames?: ReadonlyMap<string, string>
}) {
  const { t } = useTranslation()
  if (!flag.rules.length)
    return (
      <p className="text-muted-foreground">
        {t("featureFlags.differenceValue.noRules")}
      </p>
    )

  return (
    <div className="space-y-2">
      {flag.rules.map((rule, index) => (
        <details
          key={rule.id ?? `${startAt}-${index}`}
          className="group overflow-hidden rounded-md border bg-background"
          open={flag.rules.length <= 2}
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
            <span className="truncate">
              {rule.name || t("featureFlags.differenceValue.targetingRule")}
            </span>
          </summary>
          <div className="border-t">
            {(rule.conditions ?? []).length ? (
              (rule.conditions ?? []).map((condition, conditionIndex) => {
                const property = scalar(
                  condition.property ??
                    condition.key ??
                    t("featureFlags.differenceValue.condition")
                )
                const operator = scalar(
                  condition.op ?? condition.operator ?? ""
                )
                return (
                  <div
                    key={conditionIndex}
                    data-testid="rule-condition-row"
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-1.5 px-3 py-1 text-xs first:pt-2 last:pb-2"
                  >
                    <SyntaxKeyword>
                      {conditionIndex === 0
                        ? t("featureFlags.differenceValue.if")
                        : t("featureFlags.differenceValue.and")}
                    </SyntaxKeyword>
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="break-words text-foreground">
                        {property}
                      </span>
                      <span className="font-mono font-medium text-muted-foreground">
                        {operator}
                      </span>
                      {UNARY_RULE_OPERATORS.has(operator) ? null : (
                        <span className="break-words text-foreground">
                          {conditionValue(
                            property,
                            condition.value ?? condition.values ?? "",
                            segmentNames
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">
                {t("featureFlags.differenceValue.noConditions")}
              </p>
            )}
            {(rule.variations ?? []).length ? (
              <div className="border-t px-3 py-2.5">
                <RuleServeValue rule={rule} flag={flag} lang={lang} />
              </div>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  )
}

function TargetUserBadge({
  user,
  added,
  inTooltip = false,
}: {
  user: string
  added: boolean
  lang: Lang
  inTooltip?: boolean
}) {
  const { t } = useTranslation()
  return (
    <Badge
      variant="outline"
      data-user-origin={added ? "added" : "existing"}
      title={
        added
          ? t("featureFlags.differenceValue.addedFromSource")
          : t("featureFlags.differenceValue.existingInTarget")
      }
      className={
        added
          ? inTooltip
            ? "max-w-32 border-background/40 bg-primary font-normal text-primary-foreground shadow-sm"
            : "max-w-32 border-primary/40 bg-primary/10 font-normal text-primary"
          : "max-w-32 border-muted-foreground/30 bg-background font-normal"
      }
    >
      <span className="truncate">{user}</span>
    </Badge>
  )
}

function IndividualTargetingValue({
  flag,
  lang,
  addedUserKeysByVariation,
  showOriginLegend = false,
  tooltipUserStyle = "existing",
}: {
  flag: FlagComparisonValue
  lang: Lang
  addedUserKeysByVariation?: ReadonlyMap<string, ReadonlySet<string>>
  showOriginLegend?: boolean
  tooltipUserStyle?: "added" | "existing"
}) {
  const { t } = useTranslation()
  const groups = flag.targetUsers.filter((item) => item.keyIds.length)
  if (!groups.length)
    return (
      <p className="text-muted-foreground">
        {t("featureFlags.differenceValue.noIndividualTargeting")}
      </p>
    )

  return (
    <TooltipProvider>
      <div className="space-y-2.5">
        {showOriginLegend && addedUserKeysByVariation?.size ? (
          <div
            data-testid="target-user-origin-legend"
            className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm border border-muted-foreground/30 bg-background" />
              {t("featureFlags.differenceValue.existing")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm border border-primary/40 bg-primary/10" />
              {t("featureFlags.differenceValue.added")}
            </span>
          </div>
        ) : null}
        {groups.map((item) => {
          const visibleUsers = item.keyIds.slice(0, MAX_VISIBLE_TARGET_USERS)
          const hiddenCount = item.keyIds.length - visibleUsers.length
          const addedUserKeys = addedUserKeysByVariation?.get(item.variationId)
          const tooltipUsers = addedUserKeys
            ? [
                ...item.keyIds.filter((user) => !addedUserKeys.has(user)),
                ...item.keyIds.filter((user) => addedUserKeys.has(user)),
              ]
            : item.keyIds
          return (
            <div key={item.variationId} className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">
                {variationLabel(flag, item.variationId)}
              </p>
              <div className="flex flex-wrap gap-1">
                {visibleUsers.map((user) => (
                  <TargetUserBadge
                    key={user}
                    user={user}
                    added={Boolean(addedUserKeys?.has(user))}
                    lang={lang}
                  />
                ))}
                {hiddenCount > 0 ? (
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={t(
                        "featureFlags.differenceValue.showAllUsers",
                        { count: item.keyIds.length }
                      )}
                      className="inline-flex h-5 cursor-help items-center rounded-md border bg-secondary px-2 text-xs font-normal text-secondary-foreground"
                    >
                      +{hiddenCount}
                    </TooltipTrigger>
                    <TooltipContent className="max-h-64 max-w-80 overflow-y-auto">
                      <div className="min-w-0">
                        <p className="mb-1 font-medium">
                          {t("featureFlags.differenceValue.allUsers")}
                        </p>
                        <div
                          data-testid="target-users-tooltip-list"
                          className="flex flex-wrap gap-1"
                        >
                          {tooltipUsers.map((user) => (
                            <TargetUserBadge
                              key={user}
                              user={user}
                              added={
                                addedUserKeys
                                  ? addedUserKeys.has(user)
                                  : tooltipUserStyle === "added"
                              }
                              lang={lang}
                              inTooltip
                            />
                          ))}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

function getAppendedIndividualTargeting(
  target: FlagComparisonValue,
  source: FlagComparisonValue
) {
  const addedUserKeysByVariation = new Map<string, ReadonlySet<string>>()
  const missingSourceVariations = source.variations.filter(
    (sourceVariation) =>
      !target.variations.some(
        (targetVariation) => targetVariation.value === sourceVariation.value
      )
  )
  const mergedVariations = [...target.variations, ...missingSourceVariations]
  const targetUsers = mergedVariations.map((targetVariation) => {
    const existingKeys =
      target.targetUsers.find((item) => item.variationId === targetVariation.id)
        ?.keyIds ?? []
    const sourceVariation = source.variations.find(
      (variation) => variation.value === targetVariation.value
    )
    const sourceKeys = sourceVariation
      ? (source.targetUsers.find(
          (item) => item.variationId === sourceVariation.id
        )?.keyIds ?? [])
      : []
    const existingKeySet = new Set(existingKeys)
    const addedKeys = new Set(
      sourceKeys.filter((user) => !existingKeySet.has(user))
    )
    if (addedKeys.size)
      addedUserKeysByVariation.set(targetVariation.id, addedKeys)

    return {
      variationId: targetVariation.id,
      keyIds: [...new Set([...existingKeys, ...sourceKeys])],
    }
  })

  return {
    flag: { ...target, variations: mergedVariations, targetUsers },
    addedUserKeysByVariation,
  }
}

function DefaultRuleValue({
  flag,
  lang,
}: {
  flag: FlagComparisonValue
  lang: Lang
}) {
  const { t } = useTranslation()
  const variations = flag.fallthrough?.variations ?? []
  if (!variations.length)
    return (
      <p className="text-muted-foreground">
        {t("featureFlags.differenceValue.noDefaultRule")}
      </p>
    )
  const showPercentage = variations.length > 1

  return (
    <div className="space-y-1">
      {variations.map((item, index) => {
        const variationId = scalar(item.id ?? item.variationId)
        const rollout = item.rollout
        const percentage =
          showPercentage && Array.isArray(rollout)
            ? Math.round(Number(rollout[1] ?? 0) * 100)
            : null
        return (
          <p
            key={`${variationId}-${index}`}
            className="flex items-center gap-2 text-xs font-normal text-foreground"
          >
            <span data-testid="default-variation-name" className="font-normal">
              {variationLabel(flag, variationId)}
            </span>
            {percentage === null ? null : (
              <VariationPercentage
                percentage={percentage}
                testId="default-variation-percentage"
              />
            )}
          </p>
        )
      })}
      {variations.length > 1 ? (
        <DispatchKeyValue
          dispatchKey={flag.fallthrough?.dispatchKey}
          lang={lang}
        />
      ) : null}
    </div>
  )
}

function BaseValue({
  flag,
  setting,
  lang,
  tooltipUserStyle,
  segmentNames,
}: {
  flag: FlagComparisonValue
  setting: FlagDifferenceKey
  lang: Lang
  tooltipUserStyle?: "added" | "existing"
  segmentNames?: ReadonlyMap<string, string>
}) {
  if (setting === "onOffState")
    return <Badge variant="outline">{flag.isEnabled ? "ON" : "OFF"}</Badge>
  if (setting === "individualTargeting")
    return (
      <IndividualTargetingValue
        flag={flag}
        lang={lang}
        tooltipUserStyle={tooltipUserStyle}
      />
    )
  if (setting === "targetingRule")
    return <RulesValue flag={flag} lang={lang} segmentNames={segmentNames} />
  if (setting === "defaultRule")
    return <DefaultRuleValue flag={flag} lang={lang} />
  return (
    <p className="text-xs">{variationLabel(flag, flag.disabledVariationId)}</p>
  )
}

export function FlagDifferenceValue({
  flag,
  source,
  setting,
  previewMode,
  lang = "en",
  tooltipUserStyle,
  segmentNames,
}: {
  flag: FlagComparisonValue
  source?: FlagComparisonValue
  setting: FlagDifferenceKey
  previewMode?: FlagSettingCopyMode
  lang?: Lang
  tooltipUserStyle?: "added" | "existing"
  segmentNames?: ReadonlyMap<string, string>
}) {
  const { t } = useTranslation()

  if (!source || previewMode !== "append")
    return (
      <BaseValue
        flag={source ?? flag}
        setting={setting}
        lang={lang}
        tooltipUserStyle={tooltipUserStyle}
        segmentNames={segmentNames}
      />
    )

  if (setting === "targetingRule")
    return (
      <div className="space-y-3">
        <RulesValue flag={flag} lang={lang} segmentNames={segmentNames} />
        <div className="border-t pt-2">
          <p className="mb-2 text-xs font-medium">
            {t("featureFlags.differenceValue.sourceRulesAppended")}
          </p>
          <RulesValue
            flag={source}
            startAt={flag.rules.length}
            lang={lang}
            segmentNames={segmentNames}
          />
        </div>
      </div>
    )

  if (setting === "individualTargeting") {
    const merged = getAppendedIndividualTargeting(flag, source)
    return (
      <IndividualTargetingValue
        flag={merged.flag}
        lang={lang}
        addedUserKeysByVariation={merged.addedUserKeysByVariation}
        showOriginLegend
      />
    )
  }

  return (
    <BaseValue
      flag={source}
      setting={setting}
      lang={lang}
      tooltipUserStyle={tooltipUserStyle}
      segmentNames={segmentNames}
    />
  )
}
