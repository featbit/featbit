import type { SegmentCondition } from "@/features/segments/segments-types"

export function newTargetingId() {
  return crypto.randomUUID()
}

export function conditionValues(condition: SegmentCondition) {
  if (condition.op !== "IsOneOf" && condition.op !== "NotOneOf") {
    return [condition.value]
  }
  try {
    const parsed = JSON.parse(condition.value)
    return Array.isArray(parsed) ? parsed.map(String) : [condition.value]
  } catch {
    return condition.value ? [condition.value] : []
  }
}

export function withConditionValues(
  condition: SegmentCondition,
  values: string[]
) {
  return {
    ...condition,
    value:
      condition.op === "IsOneOf" || condition.op === "NotOneOf"
        ? JSON.stringify(values)
        : (values[0] ?? ""),
  }
}
