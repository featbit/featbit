import { Cable, Info, MoreHorizontal } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DetailBackLink } from "@/components/detail-back-link"
import {
  getCurrentProjectEnv,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { MetricTrendChart } from "../components/metric-trend-chart"
import {
  DataStatusBadge,
  HealthStatusBadge,
  PurposeBadge,
} from "../components/status-badges"
import {
  metricSampleText,
  monitorSampleText,
  ruleSampleText,
  sessionSampleText,
} from "../release-health-display"
import { healthSessions, metricByKey } from "../release-health-mock-data"
import type { DataStatus, HealthStatus } from "../release-health-types"
import { metricResultProfileLabel, metricUnitLabel } from "./metric-contract"

type MonitorRow = {
  flagKey: string
  monitor: string
  purpose: "observe" | "guard"
  version: number
  window: string
  reducer: "latest" | "average" | "minimum" | "maximum"
  rule: string
  status: HealthStatus
}

type EnvironmentStreamRow = {
  environmentKey: string
  environmentName: string
  connected: boolean
  provider?: string
  connection?: string
  step?: string
  syncInterval?: string
  dataStatus?: DataStatus
  latestValue?: string
  freshness?: string
}

const monitorRowsByMetricKey: Record<string, MonitorRow[]> = {
  checkout_error_rate: [
    {
      flagKey: "checkout-redesign",
      monitor: "Checkout safety monitor",
      purpose: "guard",
      version: 3,
      window: "5 min",
      reducer: "latest",
      rule: "> 2% for 5 min",
      status: "critical",
    },
    {
      flagKey: "payment-routing",
      monitor: "Payment reliability",
      purpose: "guard",
      version: 3,
      window: "10 min",
      reducer: "maximum",
      rule: "> 3% for 10 min",
      status: "healthy",
    },
  ],
  api_p95_latency: [
    {
      flagKey: "checkout-redesign",
      monitor: "Checkout safety monitor",
      purpose: "guard",
      version: 5,
      window: "10 min",
      reducer: "maximum",
      rule: "> 800 ms for 10 min",
      status: "critical",
    },
    {
      flagKey: "recommendations-v2",
      monitor: "Recommendations observation",
      purpose: "observe",
      version: 5,
      window: "15 min",
      reducer: "average",
      rule: "Observe trend",
      status: "not-evaluated",
    },
  ],
  checkout_completion_rate: [
    {
      flagKey: "checkout-redesign",
      monitor: "Checkout conversion guard",
      purpose: "guard",
      version: 2,
      window: "10 min",
      reducer: "latest",
      rule: "< 65% for 10 min",
      status: "healthy",
    },
  ],
  service_memory_saturation: [
    {
      flagKey: "search-ranking-v3",
      monitor: "Search resource watch",
      purpose: "guard",
      version: 1,
      window: "10 min",
      reducer: "maximum",
      rule: "> 90% for 10 min",
      status: "warning",
    },
  ],
  crash_free_sessions: [
    {
      flagKey: "mobile-navigation",
      monitor: "Mobile stability guard",
      purpose: "guard",
      version: 1,
      window: "10 min",
      reducer: "minimum",
      rule: "< 99.5% for 10 min",
      status: "not-evaluated",
    },
  ],
}

export function ReleaseMetricDetailsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const context = getCurrentProjectEnv()
  const metric = metricByKey(decodeURIComponent(params.metricKey ?? ""))
  const [range, setRange] = useState("1h")

  if (!metric) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t("releaseHealth.metrics.detail.notFound")}
          </p>
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <Link to={localizedPath(lang, "/release-health/metrics")} />
            }
          >
            {t("releaseHealth.metrics.detail.back")}
          </Button>
        </div>
      </div>
    )
  }

  const metricSessions = healthSessions.filter((session) =>
    session.snapshot.metricVersions.some((version) =>
      version.startsWith(metric.key)
    )
  )
  const monitorRows = monitorRowsByMetricKey[metric.key] ?? []
  const currentEnvironmentKey = context?.envKey ?? "production"
  const currentBinding = metric.environment.sourceBinding
  const environmentRows = (
    [
      {
        environmentKey: currentEnvironmentKey,
        environmentName: context?.envName ?? "Production",
        connected: Boolean(currentBinding),
        provider: currentBinding
          ? t("releaseHealth.metrics.sources.prometheusCompatible")
          : undefined,
        connection: currentBinding?.connectionName,
        step: currentBinding?.step,
        syncInterval: currentBinding?.syncInterval,
        dataStatus: currentBinding ? metric.environment.dataStatus : undefined,
        latestValue: currentBinding
          ? metric.environment.displayValue
          : undefined,
        freshness: currentBinding
          ? metricSampleText(t, metric, "updatedAt")
          : undefined,
      },
      {
        environmentKey: "staging",
        environmentName: "Staging",
        connected: false,
      },
      {
        environmentKey: "development",
        environmentName: "Development",
        connected: true,
        provider: t("releaseHealth.metrics.sources.prometheusCompatible"),
        connection: "Development Prometheus",
        step: "5m",
        syncInterval: "5m",
        dataStatus: "no-data",
        latestValue: "—",
        freshness: t("releaseHealth.metrics.detail.awaitingSamples"),
      },
    ] satisfies EnvironmentStreamRow[]
  ).filter(
    (row, index, rows) =>
      rows.findIndex(
        (candidate) => candidate.environmentKey === row.environmentKey
      ) === index
  )

  const constraints = metric.resultContract.constraints

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <DetailBackLink to={localizedPath(lang, "/release-health/metrics")}>
        {t("releaseHealth.tabs.metrics")}
      </DetailBackLink>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-normal">
              {metricSampleText(t, metric, "name")}
            </h1>
            <Badge variant="secondary">v{metric.version}</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {metricSampleText(t, metric, "description")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border bg-muted/30 px-2 py-1 text-xs">
              {metric.key}
            </code>
            <Badge variant="secondary" className="font-normal">
              {metric.category
                ? t(`releaseHealth.category.${metric.category}`)
                : t("releaseHealth.metrics.uncategorized")}
            </Badge>
            <Badge variant="outline" className="font-normal">
              {metricResultProfileLabel(t, metric)}
            </Badge>
            <Badge variant="outline" className="font-normal">
              {t("releaseHealth.resultContract.singleSeries")}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <MoreHorizontal />
          {t("releaseHealth.metrics.detail.actions")}
        </Button>
      </header>

      <Alert className="mb-5">
        <Info />
        <AlertDescription>
          {t("releaseHealth.metrics.detail.noVerdictNotice")}
        </AlertDescription>
      </Alert>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>
            {t("releaseHealth.metrics.detail.contractTitle")}
          </CardTitle>
          <CardDescription>
            {t("releaseHealth.metrics.detail.contractDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.5fr)]">
          <div className="rounded-md border bg-muted/20 p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("releaseHealth.metrics.resultSemantics")}
            </p>
            <p className="mt-2 text-sm leading-6">{metric.resultSemantics}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
            <ContractFact
              label={t("releaseHealth.metrics.measurementKind")}
              value={t(
                `releaseHealth.resultContract.measurementKind.${metric.resultContract.measurementKind}`
              )}
            />
            <ContractFact
              label={t("releaseHealth.metrics.unit")}
              value={metricUnitLabel(t, metric.resultContract.unit)}
            />
            <ContractFact
              label={t("releaseHealth.metrics.detail.constraints")}
              value={constraintLabel(constraints.minimum, constraints.maximum)}
            />
            <ContractFact
              label={t("releaseHealth.metrics.detail.resultShape")}
              value={t("releaseHealth.resultContract.singleSeries")}
            />
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>
            {t("releaseHealth.metrics.detail.environmentStreams")}
          </CardTitle>
          <CardDescription>
            {t("releaseHealth.metrics.detail.environmentStreamsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">
                  {t("releaseHealth.metrics.detail.environment")}
                </TableHead>
                <TableHead>
                  {t("releaseHealth.metrics.detail.provider")}
                </TableHead>
                <TableHead>
                  {t("releaseHealth.metrics.detail.connection")}
                </TableHead>
                <TableHead>
                  {t("releaseHealth.metrics.detail.schedule")}
                </TableHead>
                <TableHead>{t("releaseHealth.metrics.dataStatus")}</TableHead>
                <TableHead>{t("releaseHealth.metrics.latest")}</TableHead>
                <TableHead className="pr-4 text-right">
                  {t("releaseHealth.metrics.detail.sourceAction")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {environmentRows.map((row) => (
                <TableRow key={row.environmentKey}>
                  <TableCell className="pl-4">
                    <p className="font-medium">{row.environmentName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.environmentKey}
                    </p>
                  </TableCell>
                  <TableCell>{row.provider ?? "—"}</TableCell>
                  <TableCell>
                    <p>{row.connection ?? "—"}</p>
                    {row.connected ? (
                      <p className="text-xs text-muted-foreground">
                        {t("releaseHealth.metrics.detail.queryConfigured")}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.connected ? (
                      <span className="text-sm">
                        {t("releaseHealth.metrics.detail.stepAndSync", {
                          step: row.step,
                          sync: row.syncInterval,
                        })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {row.connected && row.dataStatus ? (
                      <DataStatusBadge status={row.dataStatus} />
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        {t("releaseHealth.metrics.detail.notConnected")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium tabular-nums">
                      {row.latestValue ?? "—"}
                    </p>
                    {row.freshness ? (
                      <p className="text-xs text-muted-foreground">
                        {row.freshness}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      nativeButton={false}
                      variant={row.connected ? "outline" : "default"}
                      size="sm"
                      render={
                        <Link
                          to={localizedPath(
                            lang,
                            `/release-health/metrics/${encodeURIComponent(
                              metric.key
                            )}/source-bindings/${encodeURIComponent(
                              row.environmentKey
                            )}`
                          )}
                        />
                      }
                    >
                      <Cable />
                      {t(
                        row.connected
                          ? "releaseHealth.metrics.detail.manageSource"
                          : "releaseHealth.metrics.detail.connectSource"
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4">
        <FactCard
          label={t("releaseHealth.metrics.detail.currentValue")}
          value={currentBinding ? metric.environment.displayValue : "—"}
          help={metricSampleText(t, metric, "changeLabel")}
        />
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.metrics.dataStatus")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentBinding ? (
              <DataStatusBadge status={metric.environment.dataStatus} />
            ) : (
              <Badge variant="outline">
                {t("releaseHealth.metrics.detail.notConnected")}
              </Badge>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {t("releaseHealth.metrics.detail.inEnvironment", {
                environment: context?.envName ?? "Environment",
              })}
            </p>
          </CardContent>
        </Card>
        <FactCard
          label={t("releaseHealth.metrics.detail.pointCount")}
          value={String(metric.environment.history.length)}
          help={t("releaseHealth.metrics.detail.managementWindow")}
        />
        <FactCard
          label={t("releaseHealth.metrics.freshness")}
          value={metricSampleText(t, metric, "updatedAt")}
          help={t("releaseHealth.metrics.detail.latestSample")}
          compact
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("releaseHealth.metrics.detail.trend")}</CardTitle>
          <CardDescription>
            {t("releaseHealth.metrics.detail.trendDescription", {
              environment: context?.envName ?? "Environment",
            })}
          </CardDescription>
          <CardAction>
            <Select
              value={range}
              onValueChange={(value) => value && setRange(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue>
                  {t(
                    range === "1h"
                      ? "releaseHealth.metrics.detail.lastHour"
                      : range === "6h"
                        ? "releaseHealth.metrics.detail.lastSixHours"
                        : "releaseHealth.metrics.detail.lastDay"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1h">
                    {t("releaseHealth.metrics.detail.lastHour")}
                  </SelectItem>
                  <SelectItem value="6h">
                    {t("releaseHealth.metrics.detail.lastSixHours")}
                  </SelectItem>
                  <SelectItem value="24h">
                    {t("releaseHealth.metrics.detail.lastDay")}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          <MetricTrendChart metric={metric} />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Card>
          <CardHeader>
            <CardTitle>
              {t("releaseHealth.metrics.detail.usedByTitle")}
            </CardTitle>
            <CardDescription>
              {t("releaseHealth.metrics.detail.usedByDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">
                    {t("releaseHealth.metrics.detail.monitor")}
                  </TableHead>
                  <TableHead>
                    {t("releaseHealth.metrics.detail.version")}
                  </TableHead>
                  <TableHead>
                    {t("releaseHealth.metrics.detail.observation")}
                  </TableHead>
                  <TableHead>
                    {t("releaseHealth.metrics.detail.windowReducer")}
                  </TableHead>
                  <TableHead>{t("releaseHealth.metrics.detail.use")}</TableHead>
                  <TableHead>
                    {t("releaseHealth.metrics.detail.rule")}
                  </TableHead>
                  <TableHead className="pr-4">
                    {t("releaseHealth.metrics.detail.latestAssessment")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitorRows.map((row) => (
                  <TableRow key={`${row.flagKey}-${row.monitor}`}>
                    <TableCell className="pl-4">
                      <Link
                        to={localizedPath(
                          lang,
                          `/feature-flags/${encodeURIComponent(
                            row.flagKey
                          )}/release-health`
                        )}
                        className="font-medium hover:underline"
                      >
                        {monitorSampleText(t, row.monitor)}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {row.flagKey}
                      </p>
                    </TableCell>
                    <TableCell>v{row.version}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {t("releaseHealth.scope.environment")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.window} · {t(`releaseHealth.reducer.${row.reducer}`)}
                    </TableCell>
                    <TableCell>
                      <PurposeBadge purpose={row.purpose} />
                    </TableCell>
                    <TableCell>{ruleSampleText(t, row.rule)}</TableCell>
                    <TableCell className="pr-4">
                      <HealthStatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("releaseHealth.metrics.detail.versionHistory")}
            </CardTitle>
            <CardDescription>
              {t("releaseHealth.metrics.detail.versionHistoryDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">v{metric.version}</p>
                <Badge variant="secondary">
                  {t("releaseHealth.metrics.detail.currentVersion")}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {metricResultProfileLabel(t, metric)}
              </p>
            </div>
            {metric.version > 1 ? (
              <div className="rounded-md border p-3">
                <p className="font-medium">v{metric.version - 1}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("releaseHealth.metrics.detail.historicalVersion")}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {metricSessions.length ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              {t("releaseHealth.metrics.detail.sessionMarkers")}
            </CardTitle>
            <CardDescription>
              {t("releaseHealth.metrics.detail.sessionMarkersDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {metricSessions.map((session) => (
              <Button
                key={session.id}
                nativeButton={false}
                variant="outline"
                size="sm"
                render={
                  <Link
                    to={localizedPath(
                      lang,
                      `/release-health/sessions/${session.id}`
                    )}
                  />
                }
              >
                {session.displayId} ·{" "}
                {sessionSampleText(t, session, "flagName")}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function ContractFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function FactCard({
  label,
  value,
  help,
  compact = false,
}: {
  label: string
  value: string
  help: string
  compact?: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={
            compact
              ? "text-base font-semibold"
              : "text-2xl font-semibold tracking-tight tabular-nums"
          }
        >
          {value}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      </CardContent>
    </Card>
  )
}

function constraintLabel(minimum?: number, maximum?: number) {
  if (minimum !== undefined && maximum !== undefined) {
    return `${minimum}–${maximum}`
  }
  if (minimum !== undefined) return `≥ ${minimum}`
  if (maximum !== undefined) return `≤ ${maximum}`
  return "Finite values"
}
