import type { SegmentCondition } from "@/features/segments/segments-types"

export const semVerOperators = [
  "SemVerIsOneOf",
  "SemVerNotOneOf",
  "SemVerLessThan",
  "SemVerLessEqualThan",
  "SemVerBiggerThan",
  "SemVerBiggerEqualThan",
] as const

export function isSemVerOperator(op: string) {
  return (semVerOperators as readonly string[]).includes(op)
}

export function isMultiValueOperator(op: string) {
  return ["IsOneOf", "NotOneOf", "SemVerIsOneOf", "SemVerNotOneOf"].includes(op)
}

// Keep this contract aligned with Domain/Targeting/SemanticVersion.cs.
const versionPattern =
  /^(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*))?)?(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

export function isSemanticVersion(value: string) {
  return versionPattern.exec(value)?.[0] === value
}

export function isValidSemVerCondition(
  condition: Pick<SegmentCondition, "op" | "value">
) {
  if (!isSemVerOperator(condition.op)) return true
  if (!isMultiValueOperator(condition.op))
    return isSemanticVersion(condition.value)
  try {
    const values: unknown = JSON.parse(condition.value)
    return (
      Array.isArray(values) &&
      values.length > 0 &&
      values.every(
        (value) => typeof value === "string" && isSemanticVersion(value)
      )
    )
  } catch {
    return false
  }
}
