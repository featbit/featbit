import { describe, expect, it } from "vitest"
import { parseCustomDatetime } from "./custom-datetime"

describe("custom field date and time input", () => {
  it("accepts local date/time text and preserves timezone-aware stored values", () => {
    const local = parseCustomDatetime("2026-12-15 09:30")!
    expect([
      local.getFullYear(),
      local.getMonth(),
      local.getDate(),
      local.getHours(),
      local.getMinutes(),
    ]).toEqual([2026, 11, 15, 9, 30])
    expect(
      parseCustomDatetime("2026-12-15T17:30:00+08:00")?.toISOString()
    ).toBe("2026-12-15T09:30:00.000Z")
    expect(parseCustomDatetime("2026-12-15T09:30:00.000Z")?.toISOString()).toBe(
      "2026-12-15T09:30:00.000Z"
    )
  })
  it("keeps incomplete input and impossible dates from becoming valid filters or saved values", () => {
    for (const value of [
      "",
      "2",
      "2026",
      "2026-12-15",
      "2026-12-15T09:3",
      "2026-02-30T09:30",
      "2026-12-15T25:00",
      "invalid",
      null,
      false,
    ])
      expect(parseCustomDatetime(value)).toBeUndefined()
  })
})
