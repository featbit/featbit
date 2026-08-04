import type { ChangeReviewItem } from "@/features/change-review/change-review-types"
import type {
  FeatureFlag,
  FlagVariation,
  FlagVariationType,
} from "../../flags-types"

export type VariationReference = {
  labels: string[]
  count: number
}

export type VariationReviewChange = ChangeReviewItem & {
  kind: "variation"
}

export function stableVariations(variations: FlagVariation[] | undefined) {
  return JSON.stringify(
    (variations ?? []).map((variation) => ({
      ...variation,
      name: variation.name.trim(),
    }))
  )
}

export function variationValueError(
  type: FlagVariationType,
  value: string
): "required" | "boolean" | "number" | "json" | null {
  if (!value.trim()) return "required"
  if (type === "boolean") {
    return value === "true" || value === "false" ? null : "boolean"
  }
  if (type === "number") {
    return Number.isFinite(Number(value)) ? null : "number"
  }
  if (type !== "json") return null

  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === "object" ? null : "json"
  } catch {
    return "json"
  }
}

export function variationReferences(
  flag: FeatureFlag,
  variationId: string,
  labels: {
    defaultOff: string
    defaultOn: string
    rules: (count: number) => string
    users: (count: number) => string
  }
): VariationReference {
  const result: string[] = []
  if (flag.disabledVariationId === variationId) result.push(labels.defaultOff)
  if (flag.fallthrough?.variations.some((item) => item.id === variationId)) {
    result.push(labels.defaultOn)
  }
  const ruleCount = (flag.rules ?? []).filter((rule) =>
    rule.variations.some((item) => item.id === variationId)
  ).length
  if (ruleCount) result.push(labels.rules(ruleCount))
  const userCount =
    flag.targetUsers?.find((item) => item.variationId === variationId)?.keyIds
      .length ?? 0
  if (userCount) result.push(labels.users(userCount))
  return { labels: result, count: result.length }
}

function readableVariation(variation: FlagVariation) {
  return `${variation.name.trim()} = ${variation.value}`
}

export function variationReviewChanges(
  previous: FlagVariation[],
  current: FlagVariation[]
): VariationReviewChange[] {
  const changes: VariationReviewChange[] = []
  const previousById = new Map(previous.map((item) => [item.id, item]))
  const currentById = new Map(current.map((item) => [item.id, item]))

  for (const variation of current) {
    const old = previousById.get(variation.id)
    if (!old) {
      changes.push({
        kind: "variation",
        label: variation.name.trim(),
        literalLabel: true,
        action: "added",
        current: readableVariation(variation),
      })
    } else if (
      old.name !== variation.name.trim() ||
      old.value !== variation.value
    ) {
      changes.push({
        kind: "variation",
        label: variation.name.trim() || old.name,
        literalLabel: true,
        action: "updated",
        previous: readableVariation(old),
        current: readableVariation(variation),
      })
    }
  }
  for (const variation of previous) {
    if (!currentById.has(variation.id)) {
      changes.push({
        kind: "variation",
        label: variation.name,
        literalLabel: true,
        action: "removed",
        previous: readableVariation(variation),
      })
    }
  }
  if (
    previous.length === current.length &&
    previous.every((item) => currentById.has(item.id)) &&
    previous.some((item, index) => current[index]?.id !== item.id)
  ) {
    changes.push({
      kind: "variation",
      label: "order",
      action: "updated",
      previous: previous.map((item) => item.name).join(" → "),
      current: current.map((item) => item.name.trim()).join(" → "),
    })
  }
  return changes
}
