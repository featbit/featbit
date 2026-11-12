import type { OrganizationMember } from "@/features/organization/organization-members-api"
import type { DateRange } from "react-day-picker"
import { useListQuery, useListSearch } from "@/lib/use-list-query"
import {
  filterDate,
  filterDateParam,
  memberFilter,
  memberFilterParams,
} from "@/lib/list-filter-values"
import { hasAppliedFilters } from "./audit-log-utils"

export function useAuditLogFilters(iam = false) {
  const { searchParams, updateParams } = useListQuery()
  const { search, setSearch, debouncedSearch } = useListSearch(
    searchParams,
    updateParams,
    "query",
    400
  )
  const user = memberFilter(searchParams, "creator")
  const requestedType = searchParams.get("refType") ?? ""
  const allowedTypes = iam
    ? ["Member", "Group", "Policy"]
    : ["FeatureFlag", "Segment"]
  const refType = allowedTypes.includes(requestedType) ? requestedType : ""
  const from = filterDate(searchParams.get("from"))
  const to = filterDate(searchParams.get("to"))
  const range: DateRange | undefined =
    from && (!to || to >= from) ? { from, to } : undefined
  const filtersApplied = hasAppliedFilters({
    query: search,
    creatorId: user?.id,
    refType,
    from: range?.from,
    to: range?.to,
  })
  function clearFilters() {
    setSearch("")
    updateParams({
      query: null,
      ...memberFilterParams("creator", null),
      refType: null,
      from: null,
      to: null,
    })
  }
  return {
    search,
    debouncedSearch,
    user,
    refType,
    range,
    filtersApplied,
    setSearch,
    setUser: (member: OrganizationMember | null) =>
      updateParams({
        query: search.trim() || null,
        ...memberFilterParams("creator", member),
      }),
    setRefType: (type: string) =>
      updateParams({ query: search.trim() || null, refType: type || null }),
    setRange: (value: DateRange | undefined) =>
      updateParams({
        query: search.trim() || null,
        from: filterDateParam(value?.from),
        to: filterDateParam(value?.to),
      }),
    clearFilters,
  }
}
export type AuditLogFilterState = ReturnType<typeof useAuditLogFilters>
