import { isMultiValueOperator } from "./semver"
import type { SegmentCondition } from "@/features/segments/segments-types"
import {
  isSegmentConditionProperty,
  segmentConditionValues,
} from "./segment-conditions"

export function newTargetingId() {
  return crypto.randomUUID()
}

export function conditionValues(condition: SegmentCondition) {
  if (isSegmentConditionProperty(condition.property)) {
    return segmentConditionValues(condition)
  }
  if (!isMultiValueOperator(condition.op)) {
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
    value: isMultiValueOperator(condition.op)
      ? JSON.stringify(values)
      : (values[0] ?? ""),
  }
}
