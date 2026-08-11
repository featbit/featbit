import { Clock3, Loader2, Plus, UserRoundCheck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ReviewSaveSplitButton } from "@/features/change-review/change-review-dialog"
import type {
  SegmentEndUser,
  SegmentRule,
  SegmentUserProperty,
} from "@/features/segments/segments-types"
import { RuleEditor } from "@/features/targeting/rule-editor"
import { useRuleDragPreview } from "@/features/targeting/rule-drag-preview"
import { UserPanel } from "@/features/targeting/user-panel"
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
  properties,
  disabled,
  embedded = false,
  statusLabel,
  onChange,
}: {
  flag: FeatureFlag
  value: FlagRuleVariation[]
  dispatchKey?: string | null
  properties: SegmentUserProperty[]
  disabled: boolean
  embedded?: boolean
  statusLabel?: string
  onChange: (value: FlagRuleVariation[], dispatchKey: string) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const rollout = value.length > 1
  const selectedVariation = flag.variations?.find(
    (variation) => variation.id === value[0]?.id
  )
  const selectedLabel = rollout
    ? t("featureFlags.detailsPage.rolloutPercentage")
    : selectedVariation?.name || selectedVariation?.value || ""
  const control = (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
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
              ? t("featureFlags.detailsPage.defaultServingLabel")
              : t("featureFlags.detailsPage.ruleServingLabel")
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
            <SelectItem value="__rollout">
              {t("featureFlags.detailsPage.rolloutPercentage")}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {statusLabel ? <Badge variant="outline">{statusLabel}</Badge> : null}
      {rollout && !editing ? (
        <div
          data-slot="serving-rollout-summary"
          className="flex w-full min-w-0 flex-col items-start gap-2 xl:w-auto xl:flex-1 xl:flex-row xl:items-center"
        >
          <ServingSummary flag={flag} allocations={value} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <span>{t("featureFlags.detailsPage.rollout.dispatchBy")}</span>
              <span className="font-medium text-foreground">
                {dispatchKey || "keyId"}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => setEditing(true)}
            >
              {t("featureFlags.detailsPage.editRollout")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
  const editor =
    rollout && editing ? (
      <PercentageRolloutEditor
        variations={flag.variations ?? []}
        value={value}
        dispatchKey={dispatchKey}
        properties={properties}
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
      <div className="grid grid-cols-[1.75rem_minmax(10rem,1fr)] items-start gap-3 border-t pt-3">
        <span
          data-slot="targeting-rule-serve-label"
          className="flex h-8 items-center text-xs font-medium text-muted-foreground"
        >
          {t("featureFlags.detailsPage.serve")}
        </span>
        {control}
      </div>
      {editor}
    </div>
  )
}

export function TargetingTab({
  envId,
  flag,
  users,
  properties,
  pendingCount,
  dirty,
  saving,
  toggling,
  readOnly = false,
  canToggle,
  canUpdateOffVariation,
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
  onToggle,
}: {
  envId: string
  flag: FeatureFlag
  users: Map<string, SegmentEndUser>
  properties: SegmentUserProperty[]
  pendingCount: number
  dirty: boolean
  saving: boolean
  toggling: boolean
  readOnly?: boolean
  canToggle: boolean
  canUpdateOffVariation: boolean
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
  onToggle: (nextEnabled: boolean) => void
}) {
  const { t } = useTranslation()
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

  function addRule() {
    onDraftChange({
      ...flag,
      rules: [
        ...(flag.rules ?? []),
        newFlagRule(
          t("featureFlags.detailsPage.defaultRuleName", {
            count: (flag.rules?.length ?? 0) + 1,
          })
        ),
      ],
    })
  }

  function review() {
    const next = validateTargeting(flag, {
      allocation: t("featureFlags.detailsPage.validation.allocation"),
      conditionRequired: t(
        "featureFlags.detailsPage.validation.conditionRequired"
      ),
      conditionIncomplete: t(
        "featureFlags.detailsPage.validation.conditionIncomplete"
      ),
    })
    setErrors(next)
    if (!next.size) onReview()
  }

  const defaultValue = flag.fallthrough?.variations ?? []
  const offVariation = variations.find(
    (item) => item.id === flag.disabledVariationId
  )
  const archived = Boolean(flag.isArchived)
  const canEditOffVariation = canUpdateOffVariation && !archived && !readOnly
  const canEditDefault = canUpdateDefault && !archived && !readOnly
  const canEditUsers = canUpdateUsers && !archived && !readOnly
  const canEditRules = canUpdateRules && !archived && !readOnly
  return (
    <div className="space-y-6 pt-3 pb-6">
      <section className="pt-1 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-medium">
              {t("featureFlags.detailsPage.flagStatus")}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              {toggling ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
              <Switch
                checked={flag.isEnabled}
                disabled={readOnly || toggling || !canToggle || flag.isArchived}
                aria-label={t("featureFlags.detailsPage.toggleStatus")}
                onCheckedChange={onToggle}
              />
              <span className="text-sm font-semibold">
                {t(flag.isEnabled ? "featureFlags.on" : "featureFlags.off")}
              </span>
            </div>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("featureFlags.detailsPage.statusImmediateHelp")}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-3">
          <div className="order-2 flex w-full min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 xl:order-1 xl:w-auto">
            <h2 className="text-base font-medium">
              {t("featureFlags.detailsPage.defaultRule")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("featureFlags.detailsPage.defaultRuleHelp")}
            </p>
          </div>
          <div className="order-1 ml-auto flex w-full flex-wrap items-center justify-end gap-3 xl:order-2 xl:w-auto">
            {!readOnly && pendingCount ? (
              <Button type="button" variant="outline" onClick={onOpenPending}>
                <Clock3 />
                {t("featureFlags.detailsPage.pendingChanges", {
                  count: pendingCount,
                })}
              </Button>
            ) : null}
            {dirty && !archived && !readOnly ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={onDiscard}
              >
                {t("featureFlags.detailsPage.discard")}
              </Button>
            ) : null}
            {!archived && !readOnly ? (
              <ReviewSaveSplitButton
                primaryLabel={t("featureFlags.detailsPage.reviewAndSave")}
                savingLabel={t("featureFlags.detailsPage.review.saving")}
                saving={saving}
                primaryDisabled={
                  !dirty ||
                  (!canEditOffVariation &&
                    !canEditDefault &&
                    !canEditUsers &&
                    !canEditRules)
                }
                menuLabel={t("featureFlags.detailsPage.moreActions")}
                menuSide="bottom"
                separateAfterFirst={false}
                options={[
                  {
                    label: t("featureFlags.detailsPage.scheduleChanges"),
                    icon: <Clock3 />,
                    disabled: !dirty || !scheduleGranted,
                    onSelect: onSchedule,
                  },
                  {
                    label: t("featureFlags.detailsPage.changeRequest"),
                    icon: <UserRoundCheck />,
                    disabled: !dirty || !changeRequestGranted,
                    onSelect: onChangeRequest,
                  },
                ]}
                onPrimary={review}
              />
            ) : null}
          </div>
        </div>
        <div
          className={
            errors.has("default")
              ? "overflow-hidden rounded-md border border-destructive"
              : "overflow-hidden rounded-md border"
          }
        >
          <div className="grid min-h-12 grid-cols-[3rem_minmax(0,1fr)] items-start gap-3 px-3 py-3 xl:grid-cols-[10rem_3rem_minmax(0,1fr)] xl:py-0">
            <span className="col-span-2 self-start text-sm font-semibold xl:col-span-1 xl:pt-4">
              {t("featureFlags.detailsPage.whenOn")}
            </span>
            <span
              data-slot="default-on-serve-label"
              className="flex h-12 items-center self-start text-xs text-muted-foreground"
            >
              {t("featureFlags.detailsPage.serve")}
            </span>
            <div className="min-w-0">
              <ServingControl
                embedded
                flag={flag}
                value={defaultValue}
                dispatchKey={flag.fallthrough?.dispatchKey}
                properties={properties}
                disabled={!canEditDefault}
                statusLabel={
                  !flag.isEnabled
                    ? t("featureFlags.detailsPage.inactiveNow")
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
                ? "grid min-h-12 grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 border-t px-3 py-3 xl:grid-cols-[10rem_3rem_minmax(0,1fr)] xl:py-0"
                : "grid min-h-12 grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 border-t bg-muted/60 px-3 py-3 xl:grid-cols-[10rem_3rem_minmax(0,1fr)] xl:py-0"
            }
          >
            <span className="col-span-2 text-sm font-semibold xl:col-span-1">
              {t("featureFlags.detailsPage.whenOff")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("featureFlags.detailsPage.serve")}
            </span>
            <div className="flex items-center gap-3">
              <Select
                value={flag.disabledVariationId}
                disabled={!canEditOffVariation}
                onValueChange={(value) =>
                  value &&
                  onDraftChange({ ...flag, disabledVariationId: value })
                }
              >
                <SelectTrigger
                  className="w-72 max-w-full"
                  aria-label={t("featureFlags.detailsPage.offServingLabel")}
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
                  {t("featureFlags.detailsPage.inactiveNow")}
                </Badge>
              ) : (
                <>
                  <Badge>{t("featureFlags.detailsPage.activeNow")}</Badge>
                  <span className="text-sm font-medium">
                    {t("featureFlags.detailsPage.offVariationActive", {
                      variation: offVariation?.name || offVariation?.value,
                    })}
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
        <div className="mb-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-base font-medium">
            {t("featureFlags.detailsPage.individualTargeting")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("featureFlags.detailsPage.individualTargetingHelp")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {variations.map((variation) => (
            <UserPanel
              key={variation.id}
              title={variation.name || variation.value}
              envId={envId}
              shared={false}
              keys={keysFor(variation.id)}
              users={users}
              otherKeys={allKeys.filter(
                (key) => !keysFor(variation.id).includes(key)
              )}
              disabled={!canEditUsers}
              density="compact"
              onChange={(keys) => updateUsers(variation.id, keys)}
              onResolved={onResolveUser}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">
            {t("featureFlags.detailsPage.targetingRules")}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEditRules}
            onClick={addRule}
          >
            <Plus />
            {t("featureFlags.detailsPage.addRule")}
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
                if (!canEditRules) return
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (!canEditRules) return
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
                envId={envId}
                rule={rule as SegmentRule}
                properties={properties}
                includeSegmentConditions
                disabled={!canEditRules}
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
                    properties={properties}
                    disabled={!canEditRules}
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
            <div
              data-slot="targeting-rules-empty"
              className="flex flex-col items-center rounded-md border border-dashed px-5 py-10 text-center"
            >
              <p className="text-sm text-muted-foreground">
                {t("featureFlags.detailsPage.rulesEmpty")}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-4"
                disabled={!canEditRules}
                onClick={addRule}
              >
                <Plus />
                {t("featureFlags.detailsPage.addRule")}
              </Button>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("featureFlags.detailsPage.rulesHelp")}
        </p>
      </section>
    </div>
  )
}
