import { Badge } from "@/components/ui/badge"
import type { Lang } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
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

function SyntaxKeyword({ children }: { children: string }) {
  return (
    <span className="inline-flex w-10 shrink-0 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function DispatchKeyValue({
  dispatchKey,
  lang,
}: {
  dispatchKey: unknown
  lang: Lang
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span>{lang === "zh" ? "基于属性" : "Dispatch by"}</span>
      <span data-testid="dispatch-key" className="font-normal text-foreground">
        {scalar(dispatchKey)}
      </span>
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
  const variations = rule.variations ?? []
  if (!variations.length) return null
  const showPercentage = variations.length > 1

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SyntaxKeyword>{lang === "zh" ? "返回" : "Serve"}</SyntaxKeyword>
      {variations.map((item, index) => {
        const variationId = scalar(item.id ?? item.variationId)
        const label = variationLabel(flag, variationId)
        const rollout = item.rollout
        const percentage =
          showPercentage && Array.isArray(rollout)
            ? `${Math.round(Number(rollout[1] ?? 0) * 100)}%`
            : null
        return (
          <span
            key={`${variationId}-${index}`}
            className="inline-flex items-center gap-1.5"
          >
            <Badge
              variant="outline"
              className={cn(
                label.toLowerCase() === "true" &&
                  "border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              )}
            >
              {label}
            </Badge>
            {percentage ? (
              <span className="text-xs text-muted-foreground">
                {percentage}
              </span>
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
}: {
  flag: FlagComparisonValue
  startAt?: number
  lang: Lang
}) {
  if (!flag.rules.length)
    return (
      <p className="text-muted-foreground">
        {lang === "zh" ? "无定向规则" : "No targeting rules"}
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
            <span className="truncate">{rule.name || "Targeting rule"}</span>
          </summary>
          <div className="border-t">
            {(rule.conditions ?? []).length ? (
              (rule.conditions ?? []).map((condition, conditionIndex) => (
                <div
                  key={conditionIndex}
                  className={cn(
                    "grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-1.5 px-3 py-2.5 text-xs",
                    conditionIndex > 0 && "border-t"
                  )}
                >
                  <SyntaxKeyword>
                    {conditionIndex === 0
                      ? lang === "zh"
                        ? "如果"
                        : "IF"
                      : lang === "zh"
                        ? "并且"
                        : "AND"}
                  </SyntaxKeyword>
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="break-words text-foreground">
                      {scalar(
                        condition.property ?? condition.key ?? "Condition"
                      )}
                    </span>
                    <span className="font-mono font-medium text-muted-foreground">
                      {scalar(condition.op ?? condition.operator ?? "")}
                    </span>
                    <span className="break-words text-foreground">
                      {scalar(condition.value ?? condition.values ?? "")}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">
                {lang === "zh" ? "无条件" : "No conditions"}
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

function IndividualTargetingValue({ flag }: { flag: FlagComparisonValue }) {
  const groups = flag.targetUsers.filter((item) => item.keyIds.length)
  if (!groups.length)
    return <p className="text-muted-foreground">No individual targeting</p>

  return (
    <div className="space-y-1.5">
      {groups.map((item) => (
        <p key={item.variationId} className="text-xs">
          <span className="font-medium">
            {variationLabel(flag, item.variationId)}
          </span>
          <span className="text-muted-foreground">
            {` · ${item.keyIds.length} ${item.keyIds.length === 1 ? "user" : "users"}`}
          </span>
        </p>
      ))}
    </div>
  )
}

function DefaultRuleValue({
  flag,
  lang,
}: {
  flag: FlagComparisonValue
  lang: Lang
}) {
  const variations = flag.fallthrough?.variations ?? []
  if (!variations.length)
    return <p className="text-muted-foreground">No default rule</p>
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
          <p key={`${variationId}-${index}`} className="text-xs">
            {variationLabel(flag, variationId)}
            {percentage === null ? "" : ` · ${percentage}%`}
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
}: {
  flag: FlagComparisonValue
  setting: FlagDifferenceKey
  lang: Lang
}) {
  if (setting === "onOffState")
    return <Badge variant="outline">{flag.isEnabled ? "ON" : "OFF"}</Badge>
  if (setting === "individualTargeting")
    return <IndividualTargetingValue flag={flag} />
  if (setting === "targetingRule") return <RulesValue flag={flag} lang={lang} />
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
}: {
  flag: FlagComparisonValue
  source?: FlagComparisonValue
  setting: FlagDifferenceKey
  previewMode?: FlagSettingCopyMode
  lang?: Lang
}) {
  if (!source || previewMode !== "append")
    return <BaseValue flag={source ?? flag} setting={setting} lang={lang} />

  if (setting === "targetingRule")
    return (
      <div className="space-y-3">
        <RulesValue flag={flag} lang={lang} />
        <div className="border-t pt-2">
          <p className="mb-2 text-xs font-medium">Source rules appended</p>
          <RulesValue flag={source} startAt={flag.rules.length} lang={lang} />
        </div>
      </div>
    )

  if (setting === "individualTargeting")
    return (
      <div className="space-y-3">
        <IndividualTargetingValue flag={flag} />
        <div className="border-t pt-2">
          <p className="mb-2 text-xs font-medium">Source users appended</p>
          <IndividualTargetingValue flag={source} />
        </div>
      </div>
    )

  return <BaseValue flag={source} setting={setting} lang={lang} />
}
