import { Clock3, MoreHorizontal, Plus } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Lang } from "@/features/layout/layout-types"
import {
  RuleEditor,
  UserPanel,
} from "@/features/segments/details/targeting/targeting-tab"
import type {
  SegmentEndUser,
  SegmentRule,
  SegmentUserProperty,
} from "@/features/segments/segments-types"
import { useRuleDragPreview } from "@/features/segments/details/targeting/rule-drag-preview"
import type {
  FeatureFlag,
  FlagRule,
  FlagRuleVariation,
} from "../../flags-types"
import { PercentageRolloutEditor, ServingSummary } from "./rollout-editor"
import { newFlagRule, validateTargeting } from "./targeting-utils"

function equalRollout(flag: FeatureFlag) {
  const variations = flag.variations ?? []
  const base = Math.floor(100 / Math.max(1, variations.length))
  let start = 0
  return variations.map((variation, index) => {
    const percentage =
      index === variations.length - 1 ? 100 - base * index : base
    const result: FlagRuleVariation = {
      id: variation.id,
      rollout: [start / 100, (start + percentage) / 100],
    }
    start += percentage
    return result
  })
}

function ServingControl({
  flag,
  value,
  dispatchKey,
  disabled,
  embedded = false,
  statusLabel,
  onChange,
}: {
  flag: FeatureFlag
  value: FlagRuleVariation[]
  dispatchKey?: string | null
  disabled: boolean
  embedded?: boolean
  statusLabel?: string
  onChange: (value: FlagRuleVariation[], dispatchKey: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const rollout = value.length > 1
  const selectedVariation = flag.variations?.find(
    (variation) => variation.id === value[0]?.id
  )
  const selectedLabel = rollout
    ? "Rollout percentage"
    : selectedVariation?.name || selectedVariation?.value || ""
  const control = (
    <div className="flex min-w-0 items-center gap-3">
      <Select
        value={rollout ? "__rollout" : value[0]?.id}
        disabled={disabled}
        onValueChange={(selected) => {
          if (!selected) return
          if (selected === "__rollout") {
            onChange(
              value.length > 1 ? value : equalRollout(flag),
              dispatchKey || "keyId"
            )
            setEditing(true)
          } else
            onChange(
              [{ id: selected, rollout: [0, 1] }],
              dispatchKey || "keyId"
            )
        }}
      >
        <SelectTrigger
          className="w-72 max-w-full"
          aria-label={
            embedded
              ? "Default rule serving variation"
              : "Rule serving variation"
          }
        >
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {(flag.variations ?? []).map((variation) => (
              <SelectItem key={variation.id} value={variation.id}>
                {variation.name || variation.value}
              </SelectItem>
            ))}
            <SelectItem value="__rollout">Rollout percentage</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {statusLabel ? <Badge variant="outline">{statusLabel}</Badge> : null}
      {rollout && !editing ? (
        <>
          <ServingSummary flag={flag} allocations={value} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setEditing(true)}
          >
            Edit rollout
          </Button>
        </>
      ) : null}
    </div>
  )
  const editor =
    rollout && editing ? (
      <PercentageRolloutEditor
        variations={flag.variations ?? []}
        value={value}
        dispatchKey={dispatchKey}
        disabled={disabled}
        onCancel={() => setEditing(false)}
        onApply={(next, property) => {
          onChange(next, property)
          setEditing(false)
        }}
      />
    ) : null
  if (embedded)
    return (
      <div className="min-w-0 py-2">
        {control}
        {editor}
      </div>
    )
  return (
    <div>
      <div className="grid grid-cols-[1.75rem_minmax(10rem,1fr)] items-center gap-3 border-t pt-3">
        <span className="text-xs font-semibold">Serve</span>
        {control}
      </div>
      {editor}
    </div>
  )
}

export function TargetingTab({
  lang,
  flag,
  users,
  properties,
  pendingCount,
  dirty,
  saving,
  canUpdateDefault,
  canUpdateUsers,
  canUpdateRules,
  onDraftChange,
  onResolveUser,
  onDiscard,
  onReview,
  onOpenPending,
  scheduleGranted,
  changeRequestGranted,
  onSchedule,
  onChangeRequest,
}: {
  lang: Lang
  flag: FeatureFlag
  users: Map<string, SegmentEndUser>
  properties: SegmentUserProperty[]
  pendingCount: number
  dirty: boolean
  saving: boolean
  canUpdateDefault: boolean
  canUpdateUsers: boolean
  canUpdateRules: boolean
  onDraftChange: (flag: FeatureFlag) => void
  onResolveUser: (user: SegmentEndUser) => void
  onDiscard: () => void
  onReview: () => void
  onOpenPending: () => void
  scheduleGranted: boolean
  changeRequestGranted: boolean
  onSchedule: () => void
  onChangeRequest: () => void
}) {
  const zh = lang === "zh"
  const [errors, setErrors] = useState(new Map<string, string>())
  const [dragRuleId, setDragRuleId] = useState<string | null>(null)
  const { startPreview, movePreview, removePreview } = useRuleDragPreview()
  const variations = flag.variations ?? []
  const allKeys = (flag.targetUsers ?? []).flatMap((item) => item.keyIds)

  function keysFor(variationId: string) {
    return (
      flag.targetUsers?.find((item) => item.variationId === variationId)
        ?.keyIds ?? []
    )
  }

  function updateUsers(variationId: string, keys: string[]) {
    onDraftChange({
      ...flag,
      targetUsers: variations.map((variation) => ({
        variationId: variation.id,
        keyIds:
          variation.id === variationId
            ? keys
            : keysFor(variation.id).filter((key) => !keys.includes(key)),
      })),
    })
  }

  function review() {
    const next = validateTargeting(flag)
    setErrors(next)
    if (!next.size) onReview()
  }

  const defaultValue = flag.fallthrough?.variations ?? []
  const offVariation = variations.find(
    (item) => item.id === flag.disabledVariationId
  )
  return (
    <div className="space-y-7 pt-3 pb-6">
      <section>
        <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-base font-medium">
              {zh ? "默认规则" : "Default rule"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {zh
                ? "未匹配单独定向或规则时使用。"
                : "Used when no individual target and rule matches."}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            {pendingCount ? (
              <Button type="button" variant="outline" onClick={onOpenPending}>
                <Clock3 />
                {pendingCount} {zh ? "项待处理变更" : "pending changes"}
              </Button>
            ) : null}
            {dirty ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={onDiscard}
              >
                {zh ? "放弃变更" : "Discard changes"}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={
                !dirty ||
                saving ||
                (!canUpdateDefault && !canUpdateUsers && !canUpdateRules)
              }
              onClick={review}
            >
              {zh ? "审核并保存" : "Review & save"}
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={
                            zh ? "更多定向操作" : "More targeting actions"
                          }
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={!dirty || !scheduleGranted}
                        onClick={onSchedule}
                      >
                        {zh ? "计划变更" : "Schedule changes"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!dirty || !changeRequestGranted}
                        onClick={onChangeRequest}
                      >
                        {zh ? "变更请求" : "Change request"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
              <TooltipContent>
                {zh ? "更多定向操作" : "More targeting actions"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div
          className={
            errors.has("default")
              ? "overflow-hidden rounded-md border border-destructive"
              : "overflow-hidden rounded-md border"
          }
        >
          <div className="grid min-h-12 grid-cols-[10rem_3rem_minmax(0,1fr)] items-center gap-3 px-3">
            <span className="text-sm font-semibold">
              {zh ? "功能开关开启时" : "When flag is ON"}
            </span>
            <span className="text-xs text-muted-foreground">
              {zh ? "返回" : "Serve"}
            </span>
            <div className="min-w-0">
              <ServingControl
                embedded
                flag={flag}
                value={defaultValue}
                dispatchKey={flag.fallthrough?.dispatchKey}
                disabled={!canUpdateDefault}
                statusLabel={
                  !flag.isEnabled
                    ? zh
                      ? "当前未生效"
                      : "Inactive now"
                    : undefined
                }
                onChange={(value, dispatchKey) =>
                  onDraftChange({
                    ...flag,
                    fallthrough: {
                      ...(flag.fallthrough ?? { variations: [] }),
                      variations: value,
                      dispatchKey,
                    },
                  })
                }
              />
            </div>
          </div>
          <div
            className={
              flag.isEnabled
                ? "grid min-h-12 grid-cols-[10rem_3rem_minmax(0,1fr)] items-center gap-3 border-t px-3"
                : "grid min-h-12 grid-cols-[10rem_3rem_minmax(0,1fr)] items-center gap-3 border-t bg-muted/60 px-3"
            }
          >
            <span className="text-sm font-semibold">
              {zh ? "功能开关关闭时" : "When flag is OFF"}
            </span>
            <span className="text-xs text-muted-foreground">
              {zh ? "返回" : "Serve"}
            </span>
            <div className="flex items-center gap-3">
              <Select
                value={flag.disabledVariationId}
                disabled={!canUpdateDefault}
                onValueChange={(value) =>
                  value &&
                  onDraftChange({ ...flag, disabledVariationId: value })
                }
              >
                <SelectTrigger
                  className="w-72 max-w-full"
                  aria-label="Flag OFF serving variation"
                >
                  <SelectValue>
                    {offVariation?.name || offVariation?.value || ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {variations.map((variation) => (
                      <SelectItem key={variation.id} value={variation.id}>
                        {variation.name || variation.value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {flag.isEnabled ? (
                <Badge variant="outline">
                  {zh ? "当前未生效" : "Inactive now"}
                </Badge>
              ) : (
                <>
                  <Badge variant="outline">
                    {zh ? "当前生效" : "Active now"}
                  </Badge>
                  <span className="text-sm font-medium">
                    {offVariation?.name || offVariation?.value}{" "}
                    {zh
                      ? "会为每次评估返回。"
                      : "is returned for every evaluation."}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {errors.get("default") ? (
          <p className="mt-2 text-xs text-destructive">
            {errors.get("default")}
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">
            {zh ? "单独定向" : "Individual targeting"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {zh
              ? "按键定向特定终端用户。"
              : "Target specific end users by keyId."}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {variations.map((variation) => (
            <UserPanel
              key={variation.id}
              title={variation.name || variation.value}
              envId={flag.envId ?? ""}
              shared={false}
              keys={keysFor(variation.id)}
              users={users}
              otherKeys={allKeys.filter(
                (key) => !keysFor(variation.id).includes(key)
              )}
              disabled={!canUpdateUsers}
              onChange={(keys) => updateUsers(variation.id, keys)}
              onResolved={onResolveUser}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">
            {zh ? "定向规则" : "Targeting rules"}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canUpdateRules}
            onClick={() =>
              onDraftChange({
                ...flag,
                rules: [
                  ...(flag.rules ?? []),
                  newFlagRule((flag.rules?.length ?? 0) + 1),
                ],
              })
            }
          >
            <Plus />
            {zh ? "添加规则" : "Add rule"}
          </Button>
        </div>
        <div className="space-y-3">
          {(flag.rules ?? []).map((rule, index) => (
            <div
              key={rule.id}
              data-flag-rule-id={rule.id}
              data-rule-drag-container
              className={
                errors.has(rule.id)
                  ? "rounded-md ring-1 ring-destructive"
                  : dragRuleId === rule.id
                    ? "opacity-35 transition-opacity"
                    : "transition-opacity"
              }
              onDragOver={(event) => {
                if (!canUpdateRules) return
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
              }}
              onDrop={(event) => {
                event.preventDefault()
                const sourceId =
                  event.dataTransfer.getData("text/plain") || dragRuleId
                const rules = [...(flag.rules ?? [])]
                const sourceIndex = rules.findIndex(
                  (item) => item.id === sourceId
                )
                if (sourceIndex >= 0 && sourceIndex !== index) {
                  const [moved] = rules.splice(sourceIndex, 1)
                  rules.splice(index, 0, moved)
                  onDraftChange({ ...flag, rules })
                }
                removePreview()
                setDragRuleId(null)
              }}
            >
              <RuleEditor
                rule={rule as SegmentRule}
                properties={properties}
                disabled={!canUpdateRules}
                canMoveUp={index > 0}
                canMoveDown={index < (flag.rules?.length ?? 0) - 1}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move"
                  event.dataTransfer.setData("text/plain", rule.id)
                  startPreview(event)
                  setDragRuleId(rule.id)
                }}
                onDrag={(event) => movePreview(event.clientX, event.clientY)}
                onDragEnd={() => {
                  removePreview()
                  setDragRuleId(null)
                }}
                onMoveUp={() => {
                  const rules = [...(flag.rules ?? [])]
                  ;[rules[index - 1], rules[index]] = [
                    rules[index],
                    rules[index - 1],
                  ]
                  onDraftChange({ ...flag, rules })
                }}
                onMoveDown={() => {
                  const rules = [...(flag.rules ?? [])]
                  ;[rules[index + 1], rules[index]] = [
                    rules[index],
                    rules[index + 1],
                  ]
                  onDraftChange({ ...flag, rules })
                }}
                onChange={(updated) =>
                  onDraftChange({
                    ...flag,
                    rules: (flag.rules ?? []).map((item) =>
                      item.id === rule.id
                        ? ({ ...rule, ...updated } as FlagRule)
                        : item
                    ),
                  })
                }
                onRemove={() =>
                  onDraftChange({
                    ...flag,
                    rules: (flag.rules ?? []).filter(
                      (item) => item.id !== rule.id
                    ),
                  })
                }
                footer={
                  <ServingControl
                    flag={flag}
                    value={rule.variations}
                    dispatchKey={rule.dispatchKey}
                    disabled={!canUpdateRules}
                    onChange={(value, dispatchKey) =>
                      onDraftChange({
                        ...flag,
                        rules: (flag.rules ?? []).map((item) =>
                          item.id === rule.id
                            ? { ...item, variations: value, dispatchKey }
                            : item
                        ),
                      })
                    }
                  />
                }
              />
              {errors.get(rule.id) ? (
                <p className="px-3 py-2 text-xs text-destructive">
                  {errors.get(rule.id)}
                </p>
              ) : null}
            </div>
          ))}
          {!flag.rules?.length ? (
            <div className="rounded-md border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
              {zh
                ? "暂无规则。添加规则以根据用户属性进行匹配。"
                : "No rules yet. Add a rule to match users by their properties."}
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {zh
            ? "开关开启时，匹配用户获得规则变体；未匹配用户使用默认规则。"
            : "When the flag is ON, matched users receive the rule’s variation; unmatched users fall through to the default rule."}
        </p>
      </section>
    </div>
  )
}
