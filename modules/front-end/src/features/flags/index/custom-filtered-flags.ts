import { fetchFeatureFlags } from "../flags-api"
import type { FlagListFilter, PagedFeatureFlags } from "../flags-types"
import type { DocumentationRecord } from "../custom-fields/custom-fields-model"
import { documentationRecordKey } from "../custom-fields/custom-fields-storage"
import {
  matchesCustomFieldFilters,
  type CustomFieldFilter,
  type FilterControl,
} from "../custom-fields/custom-field-filters"

// Frontend prototype: apply saved browser values before slicing the result page.
// The existing API contract remains unchanged.
export async function fetchCustomFilteredFlags(
  envId: string,
  filter: FlagListFilter,
  customFilters: CustomFieldFilter[],
  controls: FilterControl[],
  records: Record<string, DocumentationRecord>,
  fetchPage = fetchFeatureFlags
): Promise<PagedFeatureFlags> {
  if (!customFilters.length) return fetchPage(envId, filter)
  const pageSize = 30
  const first = await fetchPage(envId, { ...filter, pageIndex: 1, pageSize })
  const remaining = await Promise.all(
    Array.from(
      { length: Math.max(0, Math.ceil(first.totalCount / pageSize) - 1) },
      (_, index) =>
        fetchPage(envId, { ...filter, pageIndex: index + 2, pageSize })
    )
  )
  const items = [first, ...remaining]
    .flatMap((page) => page.items)
    .filter((flag) =>
      matchesCustomFieldFilters(
        records[documentationRecordKey(envId, flag.key)]?.customFields ?? {},
        customFilters,
        controls
      )
    )
  const start = (filter.pageIndex - 1) * filter.pageSize
  return {
    items: items.slice(start, start + filter.pageSize),
    totalCount: items.length,
  }
}
