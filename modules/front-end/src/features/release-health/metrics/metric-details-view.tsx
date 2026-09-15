import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { Clock3, Pencil, RefreshCw } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { DetailBackLink } from "@/components/detail-back-link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MetricDetailTable } from "./metric-detail-table"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import type { ProjectEnv } from "@/features/layout/layout-types"
import type { LiveMetric } from "../release-health-api"
import { DataStatusBadge } from "../components/status-badges"
import { useMetricPermissions, useMetricReadings } from "./live-metric-data"
import {
  MetricDetailContract,
  MetricDetailSource,
} from "./metric-detail-metadata"
import { MetricDetailEditor } from "./metric-detail-editor"
import { MetricDetailTimeline } from "./metric-detail-timeline"
import { MetricDetailTrend } from "./metric-detail-trend"
import { useMetricDetailData } from "./metric-detail-data"

type Range = "30m" | "1h" | "24h" | "custom"
function localDateTime(time: number) {
  const date = new Date(time)
  return new Date(time - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

export function MetricDetailsView({
  metric,
  context,
}: {
  metric: LiveMetric
  context: ProjectEnv
}) {
  const { t } = useTranslation()
  const d = (key: string) => t(`releaseHealth.live.detail.${key}`)
  const lang = resolveLang(useParams().lang)
  const client = useQueryClient()
  const [editor, setEditor] = useState<"basic" | "contract" | null>(null)
  const [range, setRange] = useState<Range>("1h")
  const [now, setNow] = useState(Date.now)
  const [custom, setCustom] = useState({ from: now - 3600_000, to: now })
  const [draft, setDraft] = useState({
    from: localDateTime(now - 3600_000),
    to: localDateTime(now),
  })
  const [rangeError, setRangeError] = useState(false)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const to = range === "custom" ? custom.to : now
  const from =
    range === "custom"
      ? custom.from
      : to - (range === "30m" ? 30 : range === "24h" ? 1440 : 60) * 60_000
  const { canCreate: canEdit, canConfigure } = useMetricPermissions(
    context.projectKey,
    context.envKey
  )
  const reading = useMetricReadings(context, [metric], 60)[0]
  const { trend, monitors, events, eventsFailed, eventsLoading } =
    useMetricDetailData(context, metric, from, to)
  const sample = reading.data?.points.at(-1)
  const source = reading.data?.source
  const connected = Boolean(
    reading.data && reading.data.status !== "not_connected"
  )
  const status = reading.isError
    ? "error"
    : reading.data?.status === "no_data"
      ? "no-data"
      : reading.data?.status
  const seconds = sample
    ? Math.max(0, Math.floor((now - Date.parse(sample.timestamp)) / 1000))
    : null
  const freshness =
    seconds === null
      ? "—"
      : t(
          `releaseHealth.live.detail.${seconds < 60 ? "secondsAgo" : seconds < 3600 ? "minutesAgo" : "hoursAgo"}`,
          {
            count:
              seconds < 60
                ? seconds
                : seconds < 3600
                  ? Math.floor(seconds / 60)
                  : Math.floor(seconds / 3600),
          }
        )
  const rangeOptions = [
    { value: "30m", label: "last30" },
    { value: "1h", label: "lastHour" },
    { value: "24h", label: "last24" },
    { value: "custom", label: "custom" },
  ]
  function applyRange() {
    const start = Date.parse(draft.from),
      end = Date.parse(draft.to)
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start >= end ||
      end > Date.now() ||
      end - start > 7 * 86400_000
    ) {
      setRangeError(true)
      return
    }
    setRangeError(false)
    setCustom({ from: start, to: end })
  }
  const editButton = (mode: "basic" | "contract") => (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={d(mode === "basic" ? "editBasic" : "editContract")}
      disabled={!canEdit}
      title={
        !canEdit
          ? t("releaseHealth.live.createPermission")
          : d(mode === "basic" ? "editBasic" : "editContract")
      }
      onClick={() => setEditor(mode)}
    >
      <Pencil />
    </Button>
  )
  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] space-y-5 bg-background px-4 py-5 sm:px-6 lg:px-8">
      <header aria-label={d("basic")} className="space-y-3">
        <DetailBackLink to={localizedPath(lang, "/release-health/metrics")}>
          {t("releaseHealth.tabs.metrics")}
        </DetailBackLink>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight break-words">
                {metric.name}
              </h1>
              <Badge variant="secondary">v{metric.version}</Badge>
              <Badge variant="outline" aria-label={d("category")}>
                {metric.category
                  ? t(`releaseHealth.category.${metric.category}`)
                  : t("releaseHealth.metrics.uncategorized")}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <code aria-label={d("key")} className="break-all">
                {metric.key}
              </code>
              <span aria-hidden="true">·</span>
              <span>{d("shared")}</span>
            </div>
            <p
              aria-label={d("description")}
              className="max-w-4xl text-sm text-muted-foreground"
            >
              {metric.description || d("noDescription")}
            </p>
          </div>
          {editButton("basic")}
        </div>
      </header>
      <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="grid min-w-0 items-start gap-5">
          <MetricDetailSource
            metric={metric}
            context={context}
            source={source}
            connected={connected}
            pending={reading.isPending}
            failed={reading.isError}
            canConfigure={canConfigure}
          />
          <MetricDetailContract
            metric={metric}
            editAction={editButton("contract")}
          />
        </aside>
        <div className="min-w-0 space-y-5">
          <Card role="region" aria-labelledby="metric-trend-heading">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>
                  <h2 id="metric-trend-heading">{d("trend")}</h2>
                </CardTitle>
                <Badge variant="secondary">{context.envName}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={d("refresh")}
                  onClick={() => {
                    setNow(Date.now())
                    void client.invalidateQueries({
                      queryKey: [
                        "release-health",
                        context.projectId,
                        context.envId,
                      ],
                    })
                  }}
                >
                  <RefreshCw />
                </Button>
                <Select
                  value={range}
                  onValueChange={(value) => {
                    if (value) {
                      setRange(value as Range)
                      setNow(Date.now())
                    }
                  }}
                >
                  <SelectTrigger className="w-44" aria-label={d("trend")}>
                    <SelectValue>
                      {d(rangeOptions.find((x) => x.value === range)!.label)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {rangeOptions.map((x) => (
                        <SelectItem key={x.value} value={x.value}>
                          {d(x.label)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {range === "custom" && (
                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="metric-range-from">{d("from")}</Label>
                      <Input
                        id="metric-range-from"
                        type="datetime-local"
                        value={draft.from}
                        onChange={(event) =>
                          setDraft({ ...draft, from: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="metric-range-to">{d("to")}</Label>
                      <Input
                        id="metric-range-to"
                        type="datetime-local"
                        value={draft.to}
                        onChange={(event) =>
                          setDraft({ ...draft, to: event.target.value })
                        }
                      />
                    </div>
                    <Button variant="outline" onClick={applyRange}>
                      {d("apply")}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {d("rangeHelp")}
                  </p>
                  {rangeError && (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                      {d("rangeInvalid")}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-muted/40 px-3 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {d("dataStatus")}
                  </span>
                  {reading.isPending ? (
                    <Badge variant="outline">{d("loading")}</Badge>
                  ) : !status || status === "not_connected" ? (
                    <Badge variant="outline">{d("notConnected")}</Badge>
                  ) : (
                    <DataStatusBadge status={status} />
                  )}
                </div>
                <div
                  className="flex items-center gap-2"
                  title={
                    sample
                      ? new Date(sample.timestamp).toLocaleString()
                      : d("noSample")
                  }
                >
                  <Clock3 className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {d("freshness")}
                  </span>
                  <span className="font-medium tabular-nums">
                    {sample ? freshness : d("noSample")}
                  </span>
                </div>
              </div>
              {trend.isPending ? (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  {d("loading")}
                </div>
              ) : trend.isError ? (
                <Alert variant="destructive">
                  <AlertDescription>{d("queryFailed")}</AlertDescription>
                </Alert>
              ) : trend.data.status === "not_connected" ? (
                <div className="flex h-64 items-center justify-center rounded-md bg-muted/25 text-sm text-muted-foreground">
                  {t("releaseHealth.live.detail.emptySource", {
                    version: metric.version,
                    environment: context.envName,
                  })}
                </div>
              ) : (
                <MetricDetailTrend
                  metric={metric}
                  trend={trend.data}
                  from={from}
                  to={to}
                />
              )}
              <div className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  {trend.data && !trend.isError
                    ? t("releaseHealth.live.detail.points", {
                        count: trend.data.points.length,
                      })
                    : ""}
                </span>
                <span>
                  {t("releaseHealth.live.detail.timezone", {
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
          <MetricDetailTimeline
            events={events}
            from={from}
            to={to}
            failed={eventsFailed}
            loading={eventsLoading}
          />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{d("monitors")}</CardTitle>
          <CardDescription>
            {t("releaseHealth.live.detail.monitorsHelp", {
              environment: context.envName,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <MetricDetailTable
            headings={[
              "monitor",
              "version",
              "status",
              "use",
              "window",
              "rule",
              "latestCheck",
            ].map(d)}
            rows={(monitors.data ?? []).map((binding) => ({
              id: binding.id,
              cells: [
                <div>
                  <Link
                    className="font-medium hover:underline"
                    to={localizedPath(
                      lang,
                      `/feature-flags/${encodeURIComponent(binding.flagKey)}/release-health`
                    )}
                  >
                    {binding.monitorName}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground">
                    {binding.flagKey}
                  </p>
                </div>,
                `v${binding.metricVersion}`,
                <Badge variant="outline">
                  {d(binding.status === "paused" ? "paused" : "enabled")}
                </Badge>,
                binding.use,
                binding.window,
                binding.rule,
                <div>
                  {binding.latestCheck ?? d("notChecked")}
                  {binding.checkedAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(binding.checkedAt).toLocaleString()}
                    </p>
                  )}
                </div>,
              ],
            }))}
            empty={d(
              monitors.isPending
                ? "loading"
                : monitors.isError
                  ? "monitorsUnavailable"
                  : "noMonitors"
            )}
          />
        </CardContent>
      </Card>
      {editor && (
        <MetricDetailEditor
          key={`${metric.revision}-${editor}`}
          metric={metric}
          mode={editor}
          onClose={() => {
            setEditor(null)
            setNow(Date.now())
          }}
        />
      )}
    </div>
  )
}
