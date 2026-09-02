import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useTranslation } from "react-i18next"
import { formatMetricValue } from "../metrics/metric-contract"
import { metricSampleText } from "../release-health-display"
import type { ReleaseMetric } from "../release-health-types"

export function MetricTrendChart({
  metric,
  height = 280,
  threshold,
  thresholdLabel,
  sessionStartLabel,
}: {
  metric: ReleaseMetric
  height?: number
  threshold?: number
  thresholdLabel?: string
  sessionStartLabel?: string
}) {
  const { t } = useTranslation()
  const gradientId = `release-health-${metric.key.replace(/[^a-z0-9]/gi, "-")}`
  const data = metric.environment.history.map((point) => ({
    ...point,
    label: point.timestamp.slice(11, 16),
  }))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 14, right: 18, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-blue-600)"
                stopOpacity={0.22}
              />
              <stop
                offset="95%"
                stopColor="var(--color-blue-600)"
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
            width={56}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickFormatter={(value) => formatMetricValue(metric, Number(value))}
          />
          <ChartTooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              borderColor: "var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--popover-foreground)",
            }}
            formatter={(value) => [
              formatMetricValue(metric, Number(value)),
              metricSampleText(t, metric, "name"),
            ]}
          />
          {threshold !== undefined ? (
            <ReferenceLine
              y={threshold}
              stroke="var(--color-red-500)"
              strokeDasharray="5 4"
              label={{
                value: thresholdLabel,
                fill: "var(--muted-foreground)",
                fontSize: 11,
                position: "insideTopRight",
              }}
            />
          ) : null}
          {sessionStartLabel ? (
            <ReferenceLine
              x={sessionStartLabel}
              stroke="var(--color-amber-500)"
              strokeDasharray="4 4"
              label={{
                value: t("releaseHealth.sessions.session"),
                fill: "var(--muted-foreground)",
                fontSize: 11,
                position: "insideTopLeft",
              }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-blue-600)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
