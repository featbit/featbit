import type { SegmentCondition } from "@/features/segments/segments-types"

export const USER_IS_IN_SEGMENT = "User is in segment"
export const USER_IS_NOT_IN_SEGMENT = "User is not in segment"

export const segmentConditionProperties = [
  USER_IS_IN_SEGMENT,
  USER_IS_NOT_IN_SEGMENT,
] as const

export function isSegmentConditionProperty(property: string) {
  return segmentConditionProperties.some((candidate) => candidate === property)
}

export function segmentConditionValues(condition: SegmentCondition) {
  if (!isSegmentConditionProperty(condition.property)) return []
  try {
    const value = JSON.parse(condition.value)
    return Array.isArray(value) ? value.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}
