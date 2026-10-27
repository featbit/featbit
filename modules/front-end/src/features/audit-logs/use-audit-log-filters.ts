import type { OrganizationMember } from "@/features/organization/organization-members-api"
import { useEffect, useState } from "react"
import type { DateRange } from "react-day-picker"
import { hasAppliedFilters } from "./audit-log-utils"

export function useAuditLogFilters() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [user, setUser] = useState<OrganizationMember | null>(null)
  const [refType, setRefType] = useState("")
  const [range, setRange] = useState<DateRange | undefined>()

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      400
    )
    return () => window.clearTimeout(timeout)
  }, [search])

  const filtersApplied = hasAppliedFilters({
    query: search,
    creatorId: user?.id,
    refType,
    from: range?.from,
    to: range?.to,
  })

  function clearFilters() {
    setSearch("")
    setDebouncedSearch("")
    setUser(null)
    setRefType("")
    setRange(undefined)
  }

  return {
    search,
    debouncedSearch,
    user,
    refType,
    range,
    filtersApplied,
    setSearch,
    setUser,
    setRefType,
    setRange,
    clearFilters,
  }
}

export type AuditLogFilterState = ReturnType<typeof useAuditLogFilters>
