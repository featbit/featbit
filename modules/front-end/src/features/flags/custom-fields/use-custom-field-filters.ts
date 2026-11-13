import { useState } from "react"
import { useProjectCustomFields } from "./use-project-custom-fields"
import {
  filterableControls,
  filterConditionIssue,
  filterControlKey,
  validCustomFilters,
  type CustomFieldFilter,
} from "./custom-field-filters"

export function useCustomFieldFilters(projectId: string, envId: string) {
  const { state, fields } = useProjectCustomFields(projectId)
  const scope = JSON.stringify([projectId, envId])
  const [selection, setSelection] = useState<{
    scope: string
    filters: CustomFieldFilter[]
  }>({ scope, filters: [] })
  const controls = filterableControls(fields)
  const filters =
    selection.scope === scope
      ? validCustomFilters(selection.filters, controls)
      : []
  const applied = filters.filter(
    (filter) =>
      filter.condition &&
      controls.some(
        (control) =>
          filterControlKey(control) === filterControlKey(filter) &&
          !filterConditionIssue(control, filter.condition!)
      )
  )
  return {
    controls,
    filters,
    applied,
    records: state.records,
    setFilters: (next: CustomFieldFilter[]) =>
      setSelection({ scope, filters: validCustomFilters(next, controls) }),
  }
}
