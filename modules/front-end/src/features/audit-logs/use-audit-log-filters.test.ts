import { createElement, type ReactNode } from "react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAuditLogFilters } from "./use-audit-log-filters"

afterEach(() => vi.useRealTimers())

describe("useAuditLogFilters", () => {
  it("debounces and trims the latest search while applying UI filters immediately", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAuditLogFilters(true), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(MemoryRouter, {}, children),
    })
    act(() => result.current.setSearch(" first "))
    expect(result.current.filtersApplied).toBe(true)
    act(() => vi.advanceTimersByTime(300))
    act(() => result.current.setSearch(" latest "))
    act(() => vi.advanceTimersByTime(399))
    expect(result.current.debouncedSearch).toBe("")
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.debouncedSearch).toBe("latest")
    expect(result.current.search).toBe("latest")
  })

  it("clears all filters immediately and cancels a pending search", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAuditLogFilters(true), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(MemoryRouter, {}, children),
    })
    act(() => {
      result.current.setSearch("old")
      result.current.setUser({
        id: "user",
        name: "User",
        email: "user@example.com",
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

describe("audit URL filters", () => {
  function setup(url: string, iam = false) {
    return renderHook(
      () => ({ filters: useAuditLogFilters(iam), location: useLocation() }),
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(MemoryRouter, { initialEntries: [url] }, children),
      }
    )
  }
  it("restores all filters immediately and clears them in one navigation", () => {
    const { result } = setup(
      "/en/audit-logs?query=checkout&creatorId=user-1&creatorName=Tester&refType=FeatureFlag&from=2026-11-01&to=2026-11-12&context=environment"
    )
    expect(result.current.filters).toMatchObject({
      debouncedSearch: "checkout",
      user: { id: "user-1", name: "Tester" },
      refType: "FeatureFlag",
      range: { from: new Date(2026, 10, 1), to: new Date(2026, 10, 12) },
    })
    act(() => result.current.filters.clearFilters())
    expect(result.current.location.search).toBe("?context=environment")
    expect(result.current.filters.filtersApplied).toBe(false)
  })
  it("ignores impossible dates, reversed ranges and resource types from another scope", () => {
    const { result } = setup(
      "/en/audit-logs?refType=Policy&from=2026-02-30&to=2026-11-12"
    )
    expect(result.current.filters.refType).toBe("")
    expect(result.current.filters.range).toBeUndefined()
    const reversed = setup(
      "/en/iam/audit-logs?refType=Group&from=2026-11-12&to=2026-11-01",
      true
    )
    expect(reversed.result.current.filters.refType).toBe("Group")
    expect(reversed.result.current.filters.range).toBeUndefined()
  })
})
