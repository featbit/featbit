import type {
  FeatureFlagInsight,
  InsightRange,
  InsightsInterval,
  InsightsPeriod,
} from "./insights-types"
import { variationChartColor } from "../../variation-colors"

export const INSIGHTS_PERIODS: InsightsPeriod[] = [
  "30m",
  "2H",
  "24H",
  "7D",
  "14D",
  "1M",
  "2M",
  "6M",
  "12M",
]

export const INSIGHTS_INTERVALS: Record<InsightsPeriod, InsightsInterval[]> = {
  "30m": ["MINUTE"],
  "2H": ["HOUR", "MINUTE"],
  "24H": ["HOUR"],
  "7D": ["DAY"],
  "14D": ["DAY"],
  "1M": ["DAY", "WEEK"],
  "2M": ["DAY", "WEEK", "MONTH"],
  "6M": ["DAY", "WEEK", "MONTH"],
  "12M": ["DAY", "WEEK", "MONTH"],
}

export function insightRange(
  period: InsightsPeriod,
  now = new Date()
): InsightRange {
  const to = startOfMinute(now)
  const from = new Date(to)

  switch (period) {
    case "30m":
      from.setMinutes(from.getMinutes() - 30)
      break
    case "2H":
      from.setHours(from.getHours() - 2)
      break
    case "24H":
      from.setHours(from.getHours() - 24)
      break
    case "7D":
      from.setDate(from.getDate() - 7)
      break
    case "14D":
      from.setDate(from.getDate() - 14)
      break
    case "1M":
      from.setMonth(from.getMonth() - 1)
      break
    case "2M":
      from.setMonth(from.getMonth() - 2)
      break
    case "6M":
      from.setMonth(from.getMonth() - 6)
      break
    case "12M":
      from.setMonth(from.getMonth() - 12)
      break
  }

  return { from: from.getTime(), to: to.getTime() }
}

function startOfMinute(date: Date) {
  const result = new Date(date)
  result.setSeconds(0, 0)
  return result
}

export function chartSeries(
  insights: FeatureFlagInsight[],
  preferredNames: string[]
) {
  const discovered = insights.flatMap((point) =>
    point.variations.map((variation) => variation.variation)
  )
  const names = Array.from(new Set([...preferredNames, ...discovered]))
  const keyByName = new Map(
    names.map((name, index) => [name, `variation${index}`])
  )

  return {
    series: names.map((name, index) => ({
      key: `variation${index}`,
      name,
      color: variationChartColor(index),
    })),
    data: insights.map((point) => {
      const row: Record<string, string | number> = {
        time: point.time,
        total: 0,
      }
      for (const variation of point.variations) {
        const key = keyByName.get(variation.variation)
        if (key) row[key] = variation.count
        row.total = Number(row.total) + variation.count
      }
      return row
    }),
  }
}
