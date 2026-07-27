import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import type {
  FeatureFlag,
  FlagRule,
  FlagRuleVariation,
  FlagTargeting,
} from "../../flags-types"

export type FlagTargetingReviewChange = ChangeReviewItem & {
  previousRule?: FlagRule
  currentRule?: FlagRule
  previousServing?: FlagServingReview
  currentServing?: FlagServingReview
}

export type FlagServingReview = {
  variations: Array<{ id: string; name: string; percentage?: number }>
  dispatchKey?: string
}

export function newFlagRule(count: number): FlagRule {
  return {
    id: crypto.randomUUID(),
    name: `Rule ${count}`,
    dispatchKey: "keyId",
    conditions: [
      {
        id: crypto.randomUUID(),
        property: "keyId",
        op: "Equal",
        value: "",
      },
    ],
    variations: [],
  }
}

export function cloneFlag(flag: FeatureFlag): FeatureFlag {
  return structuredClone(flag)
}

export function targetingOf(flag: FeatureFlag): FlagTargeting {
  return {
    targetUsers: (flag.targetUsers ?? []).filter((item) => item.keyIds.length),
    rules: flag.rules ?? [],
    fallthrough: flag.fallthrough ?? {
      variations: [],
      dispatchKey: "keyId",
    },
    exptIncludeAllTargets: flag.exptIncludeAllTargets ?? false,
  }
}

export function stableFlagTargeting(flag: FeatureFlag) {
  return JSON.stringify({
    ...targetingOf(flag),
    disabledVariationId: flag.disabledVariationId,
  })
}

export function allocationPercentages(variations: FlagRuleVariation[]) {
  return variations.map((item) => ({
    id: item.id,
    percentage: Math.round((item.rollout[1] - item.rollout[0]) * 100),
  }))
}

export function rolloutFromPercentages(
  items: Array<{ id: string; percentage: number }>
) {
  let start = 0
  return items
    .filter((item) => item.percentage > 0)
    .map((item) => {
      const end = start + item.percentage / 100
      const result: FlagRuleVariation = { id: item.id, rollout: [start, end] }
      start = end
      return result
    })
}

function servingLabel(flag: FeatureFlag, variations: FlagRuleVariation[]) {
  const allocations = allocationPercentages(variations)
  if (allocations.length === 1) {
    const variation = flag.variations?.find(
      (candidate) => candidate.id === allocations[0].id
    )
    return variation?.name || variation?.value || allocations[0].id
  }
  return allocations
    .map((item) => {
      const variation = flag.variations?.find(
        (candidate) => candidate.id === item.id
      )
      return `${variation?.name || variation?.value || item.id} ${item.percentage}%`
    })
    .join(" · ")
}

function servingReview(
  flag: FeatureFlag,
  variations: FlagRuleVariation[],
  dispatchKey?: string | null
): FlagServingReview {
  const allocations = allocationPercentages(variations)
  const showPercentage = allocations.length > 1
  return {
    variations: allocations.map((item) => {
      const variation = flag.variations?.find(
        (candidate) => candidate.id === item.id
      )
      return {
        id: item.id,
        name: variation?.name || variation?.value || item.id,
        percentage: showPercentage ? item.percentage : undefined,
      }
    }),
    dispatchKey: showPercentage ? dispatchKey || "keyId" : undefined,
  }
}

function variationLabel(flag: FeatureFlag, variationId?: string) {
  const variation = flag.variations?.find(
    (candidate) => candidate.id === variationId
  )
  return variation?.name || variation?.value || variationId || "—"
}

function stableServing(
  variations: FlagRuleVariation[],
  dispatchKey?: string | null
) {
  const allocations = allocationPercentages(variations)
  return JSON.stringify({
    allocations,
    dispatchKey: allocations.length > 1 ? dispatchKey || "keyId" : null,
  })
}

function stableRuleForReview(rule: FlagRule) {
  return JSON.stringify({
    name: rule.name,
    conditions: rule.conditions.map((condition) => ({
      id: condition.id,
      property: condition.property,
      op: condition.op,
      value: condition.value,
    })),
    serving: stableServing(rule.variations, rule.dispatchKey),
  })
}

export function targetingReviewChanges(
  previous: FeatureFlag,
  current: FeatureFlag
) {
  const changes: FlagTargetingReviewChange[] = []
  if (
    stableServing(
      previous.fallthrough?.variations ?? [],
      previous.fallthrough?.dispatchKey
    ) !==
    stableServing(
      current.fallthrough?.variations ?? [],
      current.fallthrough?.dispatchKey
    )
  ) {
    changes.push({
      kind: "default",
      label: "Flag ON",
      action: "updated",
      previous: servingLabel(previous, previous.fallthrough?.variations ?? []),
      current: servingLabel(current, current.fallthrough?.variations ?? []),
      previousServing: servingReview(
        previous,
        previous.fallthrough?.variations ?? [],
        previous.fallthrough?.dispatchKey
      ),
      currentServing: servingReview(
        current,
        current.fallthrough?.variations ?? [],
        current.fallthrough?.dispatchKey
      ),
      literalLabel: true,
    })
  }
  if (previous.disabledVariationId !== current.disabledVariationId) {
    changes.push({
      kind: "default",
      label: "Flag OFF",
      action: "updated",
      previous: variationLabel(previous, previous.disabledVariationId),
      current: variationLabel(current, current.disabledVariationId),
      previousServing: servingReview(
        previous,
        previous.disabledVariationId
          ? [{ id: previous.disabledVariationId, rollout: [0, 1] }]
          : []
      ),
      currentServing: servingReview(
        current,
        current.disabledVariationId
          ? [{ id: current.disabledVariationId, rollout: [0, 1] }]
          : []
      ),
      literalLabel: true,
    })
  }
  for (const variation of current.variations ?? []) {
    const before =
      previous.targetUsers?.find((item) => item.variationId === variation.id)
        ?.keyIds ?? []
    const after =
      current.targetUsers?.find((item) => item.variationId === variation.id)
        ?.keyIds ?? []
    const added = after.filter((key) => !before.includes(key))
    const removed = before.filter((key) => !after.includes(key))
    if (added.length || removed.length) {
      changes.push({
        kind: "targeting",
        label: variation.name || variation.value,
        valueGroups: [
          ...(added.length
            ? [{ action: "added" as const, values: added }]
            : []),
          ...(removed.length
            ? [{ action: "removed" as const, values: removed }]
            : []),
        ],
        literalLabel: true,
      })
    }
  }
  const oldRules = new Map(
    (previous.rules ?? []).map((rule) => [rule.id, rule])
  )
  const nextRules = new Map(
    (current.rules ?? []).map((rule) => [rule.id, rule])
  )
  for (const rule of current.rules ?? []) {
    const old = oldRules.get(rule.id)
    if (!old || stableRuleForReview(old) !== stableRuleForReview(rule)) {
      changes.push({
        kind: "rule",
        label: rule.name,
        action: old ? "updated" : "added",
        previous: old ? servingLabel(previous, old.variations) : undefined,
        current: servingLabel(current, rule.variations),
        previousServing: old
          ? servingReview(previous, old.variations, old.dispatchKey)
          : undefined,
        currentServing: servingReview(
          current,
          rule.variations,
          rule.dispatchKey
        ),
        previousRule: old,
        currentRule: rule,
        literalLabel: true,
      })
    }
  }
  for (const rule of previous.rules ?? []) {
    if (!nextRules.has(rule.id)) {
      changes.push({
        kind: "rule",
        label: rule.name,
        action: "removed",
        previous: servingLabel(previous, rule.variations),
        previousServing: servingReview(
          previous,
          rule.variations,
          rule.dispatchKey
        ),
        previousRule: rule,
        literalLabel: true,
      })
    }
  }
  return changes
}

export function validateTargeting(flag: FeatureFlag) {
  const errors = new Map<string, string>()
  const fallthroughTotal = allocationPercentages(
    flag.fallthrough?.variations ?? []
  ).reduce((sum, item) => sum + item.percentage, 0)
  if (fallthroughTotal !== 100)
    errors.set("default", "Allocate exactly 100% across variations.")
  for (const rule of flag.rules ?? []) {
    const total = allocationPercentages(rule.variations).reduce(
      (sum, item) => sum + item.percentage,
      0
    )
    if (!rule.conditions.length)
      errors.set(rule.id, "Add at least one complete condition.")
    else if (
      rule.conditions.some(
        (item) =>
          !item.property ||
          !item.op ||
          (!(item.op === "IsTrue" || item.op === "IsFalse") && !item.value)
      )
    ) {
      errors.set(rule.id, "Complete every condition before reviewing changes.")
    } else if (total !== 100)
      errors.set(rule.id, "Allocate exactly 100% across variations.")
  }
  return errors
}
