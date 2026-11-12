import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react"
import { useLocation, useSearchParams } from "react-router-dom"

export function positiveInt(
  value: string | null,
  fallback: number,
  allowed?: number[]
) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) &&
    parsed > 0 &&
    (!allowed || allowed.includes(parsed))
    ? parsed
    : fallback
}

// All writes in one event share a transaction, including filter + page resets.
// React Router's setSearchParams callback does not queue writes like setState.
export function useListQuery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const transaction = useRef<{
    source: URLSearchParams
    params: URLSearchParams
  } | null>(null)
  const updateParams = useCallback(
    (updates: Record<string, string | null>, resetPage = false) => {
      const current =
        transaction.current?.source === searchParams
          ? transaction.current.params
          : searchParams
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      if (resetPage) {
        next.delete("page")
        next.delete("cursor")
      }
      if (next.toString() === current.toString()) return
      transaction.current = { source: searchParams, params: next }
      setSearchParams(next, { replace: true })
    },
    [setSearchParams, searchParams]
  )
  const pageIndex = positiveInt(searchParams.get("page"), 1)
  const pageSize = positiveInt(searchParams.get("pageSize"), 10, [10, 20, 30])
  const setPageIndex = useCallback(
    (value: SetStateAction<number>) => {
      const params =
        transaction.current?.source === searchParams
          ? transaction.current.params
          : searchParams
      const current = positiveInt(params.get("page"), 1)
      const page = Math.max(
        1,
        typeof value === "function" ? value(current) : value
      )
      updateParams({ page: page === 1 ? null : String(page) })
    },
    [searchParams, updateParams]
  )
  const setPageSize = useCallback(
    (size: number) => {
      updateParams({ pageSize: String(size) }, true)
    },
    [updateParams]
  )
  return {
    searchParams,
    updateParams,
    pageIndex,
    pageSize,
    setPageIndex,
    setPageSize,
  }
}

export function useListSearch(
  searchParams: URLSearchParams,
  updateParams: ReturnType<typeof useListQuery>["updateParams"],
  key = "name",
  delay = 350
) {
  const committed = searchParams.get(key) ?? ""
  const locationKey = useLocation().key
  const [draft, setDraft] = useState({ source: locationKey, value: committed })
  if (draft.source !== locationKey) {
    setDraft({ source: locationKey, value: committed })
  }
  // URL navigation wins over a draft from the previous location.
  const search = draft.source === locationKey ? draft.value : committed
  const setSearch = useCallback(
    (value: string) => {
      setDraft({ source: locationKey, value })
    },
    [locationKey]
  )
  useEffect(() => {
    if (search.trim() === committed.trim()) return
    const timeout = window.setTimeout(
      () => updateParams({ [key]: search.trim() || null }, true),
      delay
    )
    return () => window.clearTimeout(timeout)
  }, [search, committed, key, delay, updateParams])
  return { search, setSearch, debouncedSearch: committed.trim() }
}
