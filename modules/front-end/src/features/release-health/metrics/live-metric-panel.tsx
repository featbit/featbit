import { useTranslation } from "react-i18next"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import type { LiveTrend } from "../release-health-api"

export function LiveTrendChart({
  trend,
  fractionDigits = 2,
}: {
  trend: LiveTrend
  fractionDigits?: number
}) {
  const { t } = useTranslation()
  const unit = trend.resultContract.unit
  const suffix =
    unit.kind === "percent"
      ? "%"
      : unit.kind === "duration"
        ? "ms"
        : unit.kind === "data"
          ? "B"
          : unit.kind === "rate"
            ? `${unit.numerator}/${unit.per}`
            : unit.kind
  const latest = trend.points.at(-1)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">
          {t(`releaseHealth.live.dataStatus.${trend.status}`)}
        </Badge>
        <span className="font-mono text-xl tabular-nums">
          {latest
            ? `${latest.value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits })} ${suffix}`
            : "—"}
        </span>
        <span className="text-xs text-muted-foreground">
          {trend.points.length} {t("releaseHealth.live.points")} ·{" "}
          {new Date(trend.queriedAt).toLocaleTimeString()}
        </span>
      </div>
      {trend.points.length ? (
        <div
          className="h-64 w-full"
          role="img"
          aria-label={t("releaseHealth.live.trendAria")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trend.points}
              margin={{ top: 10, right: 20, bottom: 0, left: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timestamp"
                minTickGap={70}
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} width={65} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  borderColor: "var(--border)",
                  borderRadius: 8,
                }}
                itemStyle={{ color: "var(--foreground)" }}
                labelStyle={{ color: "var(--foreground)" }}
                labelFormatter={(value) =>
                  new Date(String(value)).toLocaleString()
                }
                formatter={(value) => [
                  `${value} ${suffix}`,
                  t("releaseHealth.live.value"),
                ]}
              />
              <Line
                type="linear"
                dataKey="value"
                stroke="var(--color-primary)"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-md bg-muted/30 p-10 text-center text-muted-foreground">
          {t("releaseHealth.live.noPoints")}
        </div>
      )}
    </div>
  )
}
