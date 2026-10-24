import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAuditLogFilters } from "./use-audit-log-filters"

afterEach(() => vi.useRealTimers())

describe("useAuditLogFilters", () => {
  it("debounces and trims the latest search while applying UI filters immediately", () => {
    vi.useFakeTimers()
    const { result } = renderHook(useAuditLogFilters)
    act(() => result.current.setSearch(" first "))
    expect(result.current.filtersApplied).toBe(true)
    act(() => vi.advanceTimersByTime(300))
    act(() => result.current.setSearch(" latest "))
    act(() => vi.advanceTimersByTime(399))
    expect(result.current.debouncedSearch).toBe("")
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.debouncedSearch).toBe("latest")
    expect(result.current.search).toBe(" latest ")
  })

  it("clears all filters immediately and cancels a pending search", () => {
    vi.useFakeTimers()
    const { result } = renderHook(useAuditLogFilters)
    act(() => {
      result.current.setSearch("old")
      result.current.setUser({
        id: "user",
        type: "user",
        name: "User",
        email: null,
      })
      result.current.setRefType("Policy")
      result.current.setRange({ from: new Date(2026, 9, 20) })
    })
    act(() => vi.advanceTimersByTime(400))
    act(() => result.current.setSearch("pending"))
    act(() => result.current.clearFilters())
    expect(result.current).toMatchObject({
      search: "",
      debouncedSearch: "",
      user: null,
      refType: "",
      range: undefined,
      filtersApplied: false,
    })
    act(() => vi.advanceTimersByTime(400))
    expect(result.current.debouncedSearch).toBe("")
  })
})
