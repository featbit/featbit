import { useTranslation } from "react-i18next"
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "./empty-state"
import type { MetricKey } from "../usage-types"
import { compactNumber, metricColors, metricKeys } from "../usage-utils"

type TrendDatum = {
  date: string
  label: string
  newUsers: number
  flagEvaluations: number
  customMetrics: number
}

export function DailyTrendCard({
  data,
  isLoading,
  lang,
  selectedMetric,
  onMetricChange,
}: {
  data: TrendDatum[]
  isLoading: boolean
  lang: "en" | "zh"
  selectedMetric: MetricKey
  onMetricChange: (metric: MetricKey) => void
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
        <CardTitle>{t("workspace.usage.dailyTrend")}</CardTitle>
        <CardAction className="col-start-1 row-start-2 justify-self-start sm:col-start-2 sm:row-start-1 sm:justify-self-end">
          {isLoading ? (
            <Skeleton className="h-8 w-full sm:w-80" />
          ) : (
            <div className="inline-flex rounded-md border bg-background p-0.5">
              {metricKeys.map((metric) => (
                <Button
                  key={metric}
                  type="button"
                  variant={selectedMetric === metric ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 rounded-sm px-3 text-xs"
                  onClick={() => onMetricChange(metric)}
                >
                  {t(`workspace.usage.metrics.${metric}`)}
                </Button>
              ))}
            </div>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : data.length === 0 ? (
            <EmptyState title={t("workspace.usage.emptyTrend")} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="usageMetricGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={metricColors[selectedMetric]}
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="95%"
                      stopColor={metricColors[selectedMetric]}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-border"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(value) => compactNumber(Number(value), lang)}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <ChartTooltip
                  cursor={{
                    stroke: "currentColor",
                    strokeDasharray: "4 4",
                  }}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--popover-foreground)",
                  }}
                  labelStyle={{
                    color: "var(--popover-foreground)",
                    fontWeight: 500,
                  }}
                  itemStyle={{
                    color: metricColors[selectedMetric],
                  }}
                  formatter={(value) => [
                    compactNumber(Number(value), lang),
                    t(`workspace.usage.metrics.${selectedMetric}`),
                  ]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date ?? ""
                  }
                />
                <Area
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke={metricColors[selectedMetric]}
                  strokeWidth={2}
                  fill="url(#usageMetricGradient)"
                  dot={{ r: 2.5, strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
