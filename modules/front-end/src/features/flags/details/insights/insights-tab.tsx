import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FeatureFlag } from "../../flags-types"
import { VARIATION_CHART_COLOR_VARS } from "../../variation-colors"
import {
  fetchEvaluatedEndUsers,
  fetchFeatureFlagInsights,
} from "./insights-api"
import type { InsightsInterval, InsightsPeriod } from "./insights-types"
import {
  chartSeries,
  insightRange,
  INSIGHTS_INTERVALS,
  INSIGHTS_PERIODS,
} from "./insights-utils"

const ALL_VARIATIONS = "__all__"
const PAGE_SIZE = 10

export function InsightsTab({
  envId,
  flag,
}: {
  envId: string
  flag: FeatureFlag
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("zh") ? "zh-CN" : "en-US"
  const [period, setPeriod] = useState<InsightsPeriod>("7D")
  const [interval, setInterval] = useState<InsightsInterval>("DAY")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [variationId, setVariationId] = useState(ALL_VARIATIONS)
  const [page, setPage] = useState(1)
  const range = useMemo(() => insightRange(period), [period])

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      200
    )
    return () => window.clearTimeout(timeout)
  }, [search])

  const insightsQuery = useQuery({
    queryKey: [
      "feature-flag-insights",
      envId,
      flag.key,
      period,
      interval,
      range.from,
      range.to,
    ],
    queryFn: () =>
      fetchFeatureFlagInsights(envId, {
        featureFlagKey: flag.key,
        intervalType: interval,
        ...range,
      }),
  })
  const usersQuery = useQuery({
    queryKey: [
      "feature-flag-insight-users",
      envId,
      flag.key,
      period,
      range.from,
      range.to,
      debouncedSearch,
      variationId,
      page,
    ],
    queryFn: () =>
      fetchEvaluatedEndUsers(envId, {
        featureFlagKey: flag.key,
        query: debouncedSearch,
        variationId: variationId === ALL_VARIATIONS ? "" : variationId,
        pageIndex: page,
        pageSize: PAGE_SIZE,
        ...range,
      }),
    placeholderData: (previous) => previous,
  })

  const preferredNames = useMemo(
    () =>
      (flag.variations ?? []).map(
        (variation) => variation.name || variation.value
      ),
    [flag.variations]
  )
  const chart = useMemo(
    () => chartSeries(insightsQuery.data ?? [], preferredNames),
    [insightsQuery.data, preferredNames]
  )
  const totalEvaluations = chart.data.reduce(
    (total, point) => total + Number(point.total),
    0
  )
  const intervalOptions = INSIGHTS_INTERVALS[period]
  const totalUsers = usersQuery.data?.totalCount ?? 0
  const pageCount = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE))
  const formatNumber = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
  const formatChartTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      ...(interval === "MINUTE" || interval === "HOUR"
        ? { hour: "2-digit", minute: "2-digit" }
        : {}),
    }).format(date)
  }
  const formatTimestamp = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  function changePeriod(value: string | null) {
    if (!value) return
    const next = value as InsightsPeriod
    setPeriod(next)
    setInterval(INSIGHTS_INTERVALS[next][0])
    setPage(1)
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={changePeriod}>
          <SelectTrigger className="w-52">
            <SelectValue>
              {t(`featureFlags.detailsPage.insights.periods.${period}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {INSIGHTS_PERIODS.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`featureFlags.detailsPage.insights.periods.${item}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={interval}
          onValueChange={(value) =>
            value && setInterval(value as InsightsInterval)
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue>
              {t(`featureFlags.detailsPage.insights.intervals.${interval}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {intervalOptions.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`featureFlags.detailsPage.insights.intervals.${item}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Card className="gap-5">
        <CardHeader className="items-start">
          <CardTitle>
            {t("featureFlags.detailsPage.insights.flagEvaluations")}
          </CardTitle>
          <CardDescription>
            {t("featureFlags.detailsPage.insights.evaluationsHelp")}
          </CardDescription>
          <CardAction className="text-right">
            {insightsQuery.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-semibold tracking-tight tabular-nums">
                  {insightsQuery.isError ? "—" : formatNumber(totalEvaluations)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("featureFlags.detailsPage.insights.totalEvaluations")}
                </div>
              </>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {insightsQuery.isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : insightsQuery.isError ? (
            <ChartMessage
              message={t("featureFlags.detailsPage.insights.chartFailed")}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void insightsQuery.refetch()}
                >
                  {t("featureFlags.retry")}
                </Button>
              }
            />
          ) : (
            <div
              className={`relative h-80 [--insights-total-color:var(--color-yellow-700)] dark:[--insights-total-color:var(--color-yellow-300)] ${VARIATION_CHART_COLOR_VARS}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chart.data}
                  margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="currentColor"
                    className="text-border"
                  />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={36}
                    tickFormatter={formatChartTime}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    allowDecimals={false}
                    tickFormatter={(value) => formatNumber(Number(value))}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      borderColor: "var(--border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--popover-foreground)",
                    }}
                    labelFormatter={(value) => formatTimestamp(String(value))}
                    formatter={(value) => formatNumber(Number(value))}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="left"
                    iconType="circle"
                    iconSize={7}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name={t("featureFlags.detailsPage.insights.total")}
                    stroke="var(--insights-total-color)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  {chart.series.map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      name={series.name}
                      stroke={series.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {chart.data.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8 text-sm text-muted-foreground">
                  {t("featureFlags.detailsPage.insights.noEvaluations")}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          {t("featureFlags.detailsPage.insights.endUsers")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              className="pl-9"
              placeholder={t(
                "featureFlags.detailsPage.insights.searchPlaceholder"
              )}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
          <Select
            value={variationId}
            onValueChange={(value) => {
              if (!value) return
              setVariationId(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue>
                {variationId === ALL_VARIATIONS
                  ? t("featureFlags.detailsPage.insights.allVariations")
                  : (flag.variations ?? []).find(
                      (variation) => variation.id === variationId
                    )?.name ||
                    (flag.variations ?? []).find(
                      (variation) => variation.id === variationId
                    )?.value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_VARIATIONS}>
                  {t("featureFlags.detailsPage.insights.allVariations")}
                </SelectItem>
                {(flag.variations ?? []).map((variation) => (
                  <SelectItem key={variation.id} value={variation.id}>
                    {variation.name || variation.value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[30%] px-4">
                  {t("featureFlags.detailsPage.insights.key")}
                </TableHead>
                <TableHead className="w-[25%] px-4">
                  {t("featureFlags.detailsPage.insights.name")}
                </TableHead>
                <TableHead className="w-[20%] px-4">
                  {t("featureFlags.detailsPage.insights.variation")}
                </TableHead>
                <TableHead className="px-4">
                  {t("featureFlags.detailsPage.insights.lastEvaluated")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 4 }).map((__, cell) => (
                      <TableCell key={cell} className="h-14 px-4">
                        <Skeleton className="h-4 w-full max-w-36" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : usersQuery.isError ? (
                <TableStatus
                  message={t("featureFlags.detailsPage.insights.usersFailed")}
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void usersQuery.refetch()}
                    >
                      {t("featureFlags.retry")}
                    </Button>
                  }
                />
              ) : usersQuery.data?.items.length ? (
                usersQuery.data.items.map((user, index) => (
                  <TableRow
                    key={`${user.keyId}-${user.lastEvaluatedAt}-${index}`}
                  >
                    <TableCell className="px-4 font-mono text-xs">
                      {user.keyId}
                    </TableCell>
                    <TableCell className="px-4">
                      {user.name || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4">{user.variation}</TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {formatTimestamp(user.lastEvaluatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableStatus
                  message={t("featureFlags.detailsPage.insights.noUsers")}
                />
              )}
            </TableBody>
          </Table>
        </div>
        {!usersQuery.isError && !usersQuery.isLoading && totalUsers > 0 ? (
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>
              {t("featureFlags.detailsPage.insights.userSummary", {
                from: (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, totalUsers),
                total: totalUsers,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page <= 1 || usersQuery.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-16 text-center text-foreground">
                {t("featureFlags.detailsPage.insights.page", {
                  page,
                  count: pageCount,
                })}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page >= pageCount || usersQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function ChartMessage({
  message,
  action,
}: {
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex h-80 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <p>{message}</p>
      {action}
    </div>
  )
}

function TableStatus({
  message,
  action,
}: {
  message: string
  action?: ReactNode
}) {
  return (
    <TableRow>
      <TableCell colSpan={4} className="h-40 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        {action ? <div className="mt-3">{action}</div> : null}
      </TableCell>
    </TableRow>
  )
}
