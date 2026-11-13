import type {
  CustomControl,
  CustomField,
  CustomFieldValues,
} from "./custom-fields-model"

export const maxCustomFieldFilters = 2
export type FilterControl = {
  fieldId: string
  controlId: string
  name: string
  type: Extract<CustomControl["type"], "number" | "datetime" | "list">
  options?: string[]
}
export type ComparisonFilterCondition = {
  operator: "gt" | "lt" | "range"
  from: string
  to: string
}
export type CustomFilterCondition =
  | ComparisonFilterCondition
  | {
      operator: "any"
      values: string[]
    }
export type CustomFieldFilter = {
  fieldId: string
  controlId: string
  type?: FilterControl["type"]
  condition?: CustomFilterCondition
}
export const filterControlKey = (
  control: Pick<FilterControl, "fieldId" | "controlId">
) => JSON.stringify([control.fieldId, control.controlId])

export function filterableControls(fields: CustomField[]): FilterControl[] {
  return fields.flatMap((field) =>
    field.controls.flatMap((control) =>
      control.type === "number" ||
      control.type === "datetime" ||
      control.type === "list"
        ? [
            {
              fieldId: field.id,
              controlId: control.id,
              name: `${field.name} · ${control.label}`,
              type: control.type,
              ...(control.type === "list"
                ? { options: control.options ?? [] }
                : {}),
            },
          ]
        : []
    )
  )
}

export function comparisonValue(
  type: Exclude<FilterControl["type"], "list">,
  value: string
): number {
  if (!value.trim()) return NaN
  return type === "number" ? Number(value) : Date.parse(value)
}

export function filterConditionIssue(
  control: FilterControl,
  condition: CustomFilterCondition
): "invalid" | "reversed" | "invalidOptions" | null {
  if (control.type === "list") {
    return condition.operator === "any" &&
      condition.values.length > 0 &&
      new Set(condition.values).size === condition.values.length &&
      condition.values.every((value) => control.options?.includes(value))
      ? null
      : "invalidOptions"
  }
  if (condition.operator === "any") return "invalid"
  const from = comparisonValue(control.type, condition.from)
  const to = comparisonValue(control.type, condition.to)
  if (
    !Number.isFinite(from) ||
    (condition.operator === "range" && !Number.isFinite(to))
  )
    return "invalid"
  if (condition.operator === "range" && from > to) return "reversed"
  return null
}

export function validCustomFilters(
  filters: CustomFieldFilter[],
  controls: FilterControl[]
): CustomFieldFilter[] {
  const seen = new Set<string>()
  return filters
    .filter((filter) => {
      const key = filterControlKey(filter)
      if (seen.has(key)) return false
      seen.add(key)
      return controls.some(
        (control) =>
          filterControlKey(control) === key &&
          (!filter.type || control.type === filter.type)
      )
    })
    .slice(0, maxCustomFieldFilters)
    .map((filter) => {
      const control = controls.find(
        (item) => filterControlKey(item) === filterControlKey(filter)
      )!
      // A removed List option must not leave an apparently active, ignored filter.
      if (
        control.type === "list" &&
        filter.condition &&
        filterConditionIssue(control, filter.condition)
      )
        return { ...filter, condition: undefined }
      return filter
    })
}

export function matchesCustomFieldFilters(
  values: CustomFieldValues,
  filters: CustomFieldFilter[],
  controls: FilterControl[]
): boolean {
  return filters.every((filter) => {
    const control = controls.find(
      (item) => filterControlKey(item) === filterControlKey(filter)
    )
    if (
      !control ||
      !filter.condition ||
      filterConditionIssue(control, filter.condition)
    )
      return false
    const raw = values[control.fieldId]?.[control.controlId]
    if (control.type === "list") {
      const condition = filter.condition
      return (
        condition.operator === "any" &&
        Array.isArray(raw) &&
        condition.values.some((value) => raw.includes(value))
      )
    }
    if (filter.condition.operator === "any") return false
    const value =
      control.type === "number"
        ? typeof raw === "number"
          ? raw
          : NaN
        : typeof raw === "string"
          ? comparisonValue("datetime", raw)
          : NaN
    if (!Number.isFinite(value)) return false
    const { operator, from, to } = filter.condition
    const lower = comparisonValue(control.type, from)
    if (operator === "gt") return value > lower
    if (operator === "lt") return value < lower
    return value >= lower && value <= comparisonValue(control.type, to)
  })
}
