import { describe, expect, it } from "vitest"
import { chartSeries, insightRange, INSIGHTS_INTERVALS } from "./insights-utils"
import { VARIATION_CHART_COLORS } from "../../variation-colors"

describe("insights utilities", () => {
  it("keeps the Angular-compatible interval choices", () => {
    expect(INSIGHTS_INTERVALS["30m"]).toEqual(["MINUTE"])
    expect(INSIGHTS_INTERVALS["2H"]).toEqual(["HOUR", "MINUTE"])
    expect(INSIGHTS_INTERVALS["1M"]).toEqual(["DAY", "WEEK"])
    expect(INSIGHTS_INTERVALS["12M"]).toEqual(["DAY", "WEEK", "MONTH"])
  })

  it("builds a minute-aligned period range", () => {
    const now = new Date("2026-07-27T12:34:56.789Z")
    const range = insightRange("2H", now)

    expect(new Date(range.to).toISOString()).toBe("2026-07-27T12:34:00.000Z")
    expect(new Date(range.from).toISOString()).toBe("2026-07-27T10:34:00.000Z")
  })

  it("creates a total and stable variation series", () => {
    const result = chartSeries(
      [
        {
          time: "2026-07-27T12:00:00Z",
          variations: [
            { variation: "New checkout", count: 7 },
            { variation: "Control", count: 11 },
          ],
        },
      ],
      ["Control", "New checkout"]
    )

    expect(result.series.map((series) => series.name)).toEqual([
      "Control",
      "New checkout",
    ])
    expect(result.series.map((series) => series.color)).toEqual(
      VARIATION_CHART_COLORS.slice(0, 2)
    )
    expect(result.data[0]).toMatchObject({
      total: 18,
      variation0: 11,
      variation1: 7,
    })
  })

  it("keeps variation legend context when the period has no data", () => {
    const result = chartSeries([], ["Control", "New checkout"])

    expect(result.series.map((series) => series.name)).toEqual([
      "Control",
      "New checkout",
    ])
    expect(result.data).toEqual([])
  })
})
