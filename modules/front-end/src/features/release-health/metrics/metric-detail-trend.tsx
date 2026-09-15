import { useTranslation } from "react-i18next"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { LiveMetric, LiveTrend } from "../release-health-api"
import { metricValue } from "./live-metric-data"

export function MetricDetailTrend({
  metric,
  trend,
  from,
  to,
}: {
  metric: LiveMetric
  trend: LiveTrend
  from: number
  to: number
}) {
  const { t } = useTranslation()
  const data = trend.points.map((x) => ({
    ...x,
    time: Date.parse(x.timestamp),
  }))
  const revisions = [...new Set(data.map((x) => x.sourceBindingRevision ?? 0))]
  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label={t("releaseHealth.live.detail.trend")}
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 20, bottom: 0, left: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={[from, to]}
              ticks={Array.from(
                { length: 5 },
                (_, index) => from + ((to - from) * index) / 4
              )}
              allowDataOverflow
              minTickGap={60}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) =>
                new Date(value).toLocaleString([], {
                  ...(to - from >= 86400_000
                    ? ({ month: "short", day: "numeric" } as const)
                    : {}),
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
            />
            <YAxis
              width={65}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => metricValue(metric, Number(value))}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                borderRadius: 8,
              }}
              labelFormatter={(value) =>
                new Date(Number(value)).toLocaleString()
              }
              formatter={(value) => [
                metricValue(metric, Number(value)),
                metric.name,
              ]}
            />
            {revisions.map((revision) => (
              <Line
                key={revision}
                type="linear"
                dataKey={(point: (typeof data)[number]) =>
                  (point.sourceBindingRevision ?? 0) === revision
                    ? point.value
                    : null
                }
                stroke="var(--primary)"
                dot={false}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center rounded-md bg-muted/25 text-sm text-muted-foreground">
          {t("releaseHealth.live.detail.noData")}
        </div>
      )}
    </div>
  )
}
