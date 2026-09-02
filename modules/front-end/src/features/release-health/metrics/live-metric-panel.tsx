import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  releaseHealthApi,
  type LiveMetric,
  type LiveTrend,
  type ReleaseHealthScope,
} from "../release-health-api"
import { LiveBindingEditor } from "./live-source-binding-editor"

export function LiveMetricPanel({
  metric,
  scope,
}: {
  metric: LiveMetric
  scope: ReleaseHealthScope
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const key = [
    "release-health",
    scope.projectId,
    scope.envId,
    metric.id,
    "trend",
  ]
  const trend = useQuery({
    queryKey: key,
    queryFn: () => releaseHealthApi.trend(scope, metric.id),
    refetchInterval: 10000,
    retry: false,
  })
  return (
    <section className="space-y-5 rounded-lg border p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {metric.name} <Badge variant="outline">v{metric.version}</Badge>
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {metric.key}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {metric.resultSemantics}
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing(!editing)}>
          {t("releaseHealth.live.manageBinding")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("releaseHealth.live.trendHelp")}
      </p>
      {trend.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("releaseHealth.live.queryFailed")}
          </AlertDescription>
        </Alert>
      ) : trend.data ? (
        <LiveTrendChart trend={trend.data} />
      ) : (
        <p>{t("releaseHealth.live.loading")}</p>
      )}
      {editing ? (
        <LiveBindingEditor
          scope={scope}
          metric={metric}
          onSaved={() => {
            setEditing(false)
            void client.invalidateQueries({ queryKey: key })
          }}
        />
      ) : null}
    </section>
  )
}

export function LiveTrendChart({ trend }: { trend: LiveTrend }) {
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
            ? `${latest.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${suffix}`
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
