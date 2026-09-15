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
import { Badge } from "@/components/ui/badge"
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
  const last = trend.points.at(-1)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Badge variant="outline">
          {t("releaseHealth.live.detail.onDemand")}
        </Badge>
        <span>
          {t("releaseHealth.live.detail.rangeValue")}:{" "}
          <strong className="font-mono text-foreground">
            {last ? metricValue(metric, last.value) : "—"}
          </strong>
        </span>
        <span>
          {t("releaseHealth.live.detail.points", { count: data.length })}
        </span>
      </div>
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
                allowDataOverflow
                minTickGap={60}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) =>
                  new Date(value).toLocaleTimeString([], {
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
    </div>
  )
}
