import type {
  CurrentCycleDates,
  DailyTrendItem,
  MetricKey,
  PeriodKey,
  WorkspaceUsageFilter,
} from "./usage-types"

const dayMs = 24 * 60 * 60 * 1000
const maxChartDays = 370

export const metricKeys = [
  "newUsers",
  "flagEvaluations",
  "customMetrics",
] as const

export const metricColors: Record<MetricKey, string> = {
  newUsers: "#16a34a",
  flagEvaluations: "#2563eb",
  customMetrics: "#f59e0b",
}

export function parseDate(value?: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function formatFilterDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatRangeDate(date: Date, lang: "en" | "zh") {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function formatChartDate(date: string, lang: "en" | "zh") {
  const parsed = parseDate(`${date}T00:00:00`)
  if (!parsed) {
    return date
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "2-digit",
  }).format(parsed)
}

export function compactNumber(value: number, lang: "en" | "zh") {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export function integerNumber(value: number, lang: "en" | "zh") {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value)
}

export function getCurrentCycleDates(cycle?: {
  startDate?: string
  endDate?: string
}): CurrentCycleDates {
  const start = parseDate(cycle?.startDate)
  const rawEnd = parseDate(cycle?.endDate)

  if (!start || !rawEnd) {
    return null
  }

  return {
    startDate: start,
    endDate: addDays(rawEnd, -1),
    rawEndDate: rawEnd,
  }
}

export function isMonthlyCycle(cycle: CurrentCycleDates) {
  if (!cycle) {
    return false
  }

  return (cycle.rawEndDate.getTime() - cycle.startDate.getTime()) / dayMs <= 31
}

function defaultMonthFilter() {
  const now = new Date()
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    prevStartDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    prevEndDate: new Date(now.getFullYear(), now.getMonth(), 0),
  }
}

export function buildUsageFilter(
  selectedPeriod: PeriodKey,
  cycle: CurrentCycleDates
): WorkspaceUsageFilter {
  const now = new Date()
  let dates = defaultMonthFilter()

  switch (selectedPeriod) {
    case "last7d": {
      const endDate = now
      const startDate = addDays(now, -6)
      const prevEndDate = addDays(startDate, -1)
      dates = {
        startDate,
        endDate,
        prevEndDate,
        prevStartDate: addDays(prevEndDate, -6),
      }
      break
    }
    case "last30d": {
      const endDate = now
      const startDate = addDays(now, -29)
      const prevEndDate = addDays(startDate, -1)
      dates = {
        startDate,
        endDate,
        prevEndDate,
        prevStartDate: addDays(prevEndDate, -29),
      }
      break
    }
    case "currentBilling":
      if (cycle) {
        const prevEndDate = addDays(cycle.startDate, -1)
        dates = {
          startDate: cycle.startDate,
          endDate: cycle.endDate,
          prevEndDate,
          prevStartDate: addDays(addMonths(prevEndDate, -1), 1),
        }
      }
      break
    case "previousBilling":
      if (cycle) {
        const endDate = addDays(cycle.startDate, -1)
        const startDate = addDays(addMonths(endDate, -1), 1)
        const prevEndDate = addDays(startDate, -1)
        dates = {
          startDate,
          endDate,
          prevEndDate,
          prevStartDate: addDays(addMonths(prevEndDate, -1), 1),
        }
      }
      break
    case "thisMonth":
    default:
      break
  }

  return {
    startDate: formatFilterDate(dates.startDate),
    endDate: formatFilterDate(dates.endDate),
    prevStartDate: formatFilterDate(dates.prevStartDate),
    prevEndDate: formatFilterDate(dates.prevEndDate),
  }
}

export function rangeLabel(filter: WorkspaceUsageFilter, lang: "en" | "zh") {
  const start = parseDate(`${filter.startDate}T00:00:00`)
  const end = parseDate(`${filter.endDate}T00:00:00`)

  if (!start || !end) {
    return ""
  }

  return `${formatRangeDate(start, lang)} - ${formatRangeDate(end, lang)}`
}

export function buildTrendData({
  dailyTrend,
  filter,
  lang,
}: {
  dailyTrend: DailyTrendItem[]
  filter: WorkspaceUsageFilter
  lang: "en" | "zh"
}) {
  const trendMap = new Map(dailyTrend.map((item) => [item.date, item]))

  return generateDateRange(filter.startDate, filter.endDate).map((date) => {
    const item = trendMap.get(date)
    return {
      date,
      label: formatChartDate(date, lang),
      newUsers: item?.newUsers ?? 0,
      flagEvaluations: item?.flagEvaluations ?? 0,
      customMetrics: item?.customMetrics ?? 0,
    }
  })
}

function generateDateRange(startDate: string, endDate: string) {
  const dates: string[] = []
  const current = parseDate(`${startDate}T00:00:00`)
  const end = parseDate(`${endDate}T00:00:00`)

  if (!current || !end) {
    return dates
  }

  while (current <= end && dates.length < maxChartDays) {
    dates.push(formatFilterDate(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

export function getChangePercent(current: number, previous: number) {
  if (previous === 0) {
    return 0
  }

  return Math.round(((current - previous) / previous) * 100)
}

export function getUsagePercent(value: number, total: number) {
  if (total === 0) {
    return 0
  }

  return Math.round((value / total) * 1000) / 10
}

export function getVsLabel(selectedPeriod: PeriodKey, t: (key: string) => string) {
  switch (selectedPeriod) {
    case "last7d":
      return t("workspace.usage.vs.prev7d")
    case "last30d":
      return t("workspace.usage.vs.prev30d")
    case "currentBilling":
    case "previousBilling":
      return t("workspace.usage.vs.prevPeriod")
    case "thisMonth":
    default:
      return t("workspace.usage.vs.lastMonth")
  }
}
