import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { Cable, Pencil, RefreshCw } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { DetailBackLink } from "@/components/detail-back-link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import {
  metricResultProfileLabel,
  metricUnitLabel,
  resultContractRange,
} from "./metric-contract"
import {
  metricValue,
  useMetricPermissions,
  useMetricReadings,
} from "./live-metric-data"
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
  const intrinsic = resultContractRange(metric.resultContract.unit)
  const minimum = metric.resultContract.constraints.minimum ?? intrinsic.minimum
  const maximum = metric.resultContract.constraints.maximum ?? intrinsic.maximum
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
      variant="outline"
      size="sm"
      disabled={!canEdit}
      title={!canEdit ? t("releaseHealth.live.createPermission") : undefined}
      onClick={() => setEditor(mode)}
    >
      <Pencil />
      {d(mode === "basic" ? "editBasic" : "editContract")}
    </Button>
  )
  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] space-y-4 bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DetailBackLink to={localizedPath(lang, "/release-health/metrics")}>
          {t("releaseHealth.tabs.metrics")}
        </DetailBackLink>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{d("shared")}</Badge>
          <Badge variant="secondary">v{metric.version}</Badge>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{d("basic")}</CardTitle>
          <CardAction>{editButton("basic")}</CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.7fr_0.8fr]">
            <Fact label={d("name")}>
              <h1 className="text-lg font-semibold tracking-tight">
                {metric.name}
              </h1>
            </Fact>
            <Fact label={d("key")}>
              <code className="text-sm break-all">{metric.key}</code>
            </Fact>
            <Fact label={d("description")}>{metric.description || "—"}</Fact>
            <Fact label={d("category")}>
              {metric.category
                ? t(`releaseHealth.category.${metric.category}`)
                : "—"}
            </Fact>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{d("contract")}</CardTitle>
          <CardAction>{editButton("contract")}</CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-6 lg:grid-cols-[2fr_1fr_1fr]">
            <Fact label={d("semantics")}>{metric.resultSemantics}</Fact>
            <Fact label={d("kind")}>
              {t(
                `releaseHealth.resultContract.measurementKind.${metric.resultContract.measurementKind}`
              )}
            </Fact>
            <Fact label={d("unit")}>
              {metricUnitLabel(t, metric.resultContract.unit)}
            </Fact>
          </dl>
          <div className="grid gap-5 border-t pt-4 lg:grid-cols-2">
            <section>
              <h3 className="mb-3 text-sm font-medium">{d("shape")}</h3>
              <dl className="grid grid-cols-3 gap-4">
                <Fact label={d("resultKind")}>{d("numericSeries")}</Fact>
                <Fact label={d("cardinality")}>{d("single")}</Fact>
                <Fact label={d("profile")}>
                  {metricResultProfileLabel(t, metric)}
                </Fact>
              </dl>
            </section>
            <section>
              <h3 className="mb-3 text-sm font-medium">{d("constraints")}</h3>
              <dl className="grid grid-cols-3 gap-4">
                <Fact label={d("minimum")}>{minimum}</Fact>
                <Fact label={d("maximum")}>{maximum ?? "—"}</Fact>
                <Fact label={d("digits")}>{metric.fractionDigits ?? 2}</Fact>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                {d("constraintsHelp")}
              </p>
            </section>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{d("source")}</CardTitle>
          <CardDescription>
            {t("releaseHealth.live.detail.sourceHelp", {
              environment: context.envName,
              version: metric.version,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <MetricDetailTable
            headings={[
              t("releaseHealth.metrics.detail.environment"),
              d("provider"),
              d("connection"),
              d("step"),
              d("source"),
            ]}
            alignLast
            rows={[
              {
                id: context.envId,
                cells: [
                  <div>
                    <p className="font-medium">{context.envName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {context.envKey}
                    </p>
                  </div>,
                  source?.providerType ?? "—",
                  source?.connectionName ?? "—",
                  source ? `${source.step} · ${d("onDemand")}` : "—",
                  <Button
                    nativeButton={false}
                    variant={
                      connected || reading.isError ? "outline" : "default"
                    }
                    size="sm"
                    disabled={!canConfigure || reading.isPending}
                    render={
                      <Link
                        to={localizedPath(
                          lang,
                          `/release-health/metrics/${encodeURIComponent(metric.key)}/source-bindings/${encodeURIComponent(context.envKey)}`
                        )}
                      />
                    }
                  >
                    <Cable />
                    {d(connected || reading.isError ? "manage" : "connect")}
                  </Button>,
                ],
              },
            ]}
          />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>{d("dataStatus")}</CardDescription>
          </CardHeader>
          <CardContent>
            {reading.isPending ? (
              <Badge variant="outline">{d("loading")}</Badge>
            ) : !status || status === "not_connected" ? (
              <Badge variant="outline">{d("notConnected")}</Badge>
            ) : (
              <DataStatusBadge status={status} />
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {context.envName}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{d("latest")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {sample ? metricValue(metric, sample.value) : "—"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {reading.isError || status === "stale"
                ? t("releaseHealth.live.lastSuccessful")
                : d("latestSample")}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>{d("freshness")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-semibold tabular-nums"
              title={
                sample ? new Date(sample.timestamp).toLocaleString() : undefined
              }
            >
              {freshness}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sample
                ? new Date(sample.timestamp).toLocaleString()
                : d("noSample")}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{d("trend")}</CardTitle>
          <CardDescription>
            {t("releaseHealth.live.detail.trendHelp", {
              environment: context.envName,
            })}
          </CardDescription>
          <CardAction>
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
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
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
          <p className="text-xs text-muted-foreground">
            {t("releaseHealth.live.detail.timezone", {
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })}
          </p>
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
          <MetricDetailTimeline
            events={events}
            from={from}
            to={to}
            failed={eventsFailed}
            loading={eventsLoading}
          />
        </CardContent>
      </Card>
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

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-sm leading-6 break-words">{children}</dd>
    </div>
  )
}
