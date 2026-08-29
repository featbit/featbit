import { Info, MoreHorizontal } from "lucide-react"
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
  ObservationScopeBadge,
  PurposeBadge,
} from "../components/status-badges"
import {
  metricSampleText,
  monitorSampleText,
  ruleSampleText,
  sessionSampleText,
} from "../release-health-display"
import { healthSessions, metricByKey } from "../release-health-mock-data"
import type { HealthStatus } from "../release-health-types"

type MonitorRow = {
  flagKey: string
  monitor: string
  purpose: "observe" | "guard"
  rule: string
  status: HealthStatus
}

const monitorRowsByMetricKey: Record<string, MonitorRow[]> = {
  checkout_error_rate: [
    {
      flagKey: "checkout-redesign",
      monitor: "Checkout safety monitor",
      purpose: "guard",
      rule: "> 2% for 5 min",
      status: "critical",
    },
    {
      flagKey: "payment-routing",
      monitor: "Payment reliability",
      purpose: "guard",
      rule: "> 3% for 10 min",
      status: "healthy",
    },
  ],
  api_p95_latency: [
    {
      flagKey: "checkout-redesign",
      monitor: "Checkout safety monitor",
      purpose: "guard",
      rule: "> 800 ms for 10 min",
      status: "critical",
    },
    {
      flagKey: "payment-routing",
      monitor: "Payment reliability",
      purpose: "guard",
      rule: "> 950 ms for 15 min",
      status: "healthy",
    },
    {
      flagKey: "recommendations-v2",
      monitor: "Recommendations observation",
      purpose: "observe",
      rule: "Observe trend",
      status: "not-evaluated",
    },
  ],
  checkout_completion_rate: [
    {
      flagKey: "checkout-redesign",
      monitor: "Checkout conversion guard",
      purpose: "guard",
      rule: "< 65% for 10 min",
      status: "healthy",
    },
  ],
  service_memory_saturation: [
    {
      flagKey: "checkout-redesign",
      monitor: "Checkout resource watch",
      purpose: "guard",
      rule: "> 85% for 10 min",
      status: "not-evaluated",
    },
    {
      flagKey: "search-ranking-v3",
      monitor: "Search resource watch",
      purpose: "guard",
      rule: "> 90% for 10 min",
      status: "warning",
    },
  ],
  crash_free_sessions: [
    {
      flagKey: "mobile-navigation",
      monitor: "Mobile stability guard",
      purpose: "guard",
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
              {t(`releaseHealth.category.${metric.category}`)}
            </Badge>
            <Badge variant="outline" className="font-normal">
              {t(`releaseHealth.signal.${metric.signalType}`)}
            </Badge>
            <ObservationScopeBadge scope={metric.observationScope} />
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

      <div className="grid gap-4 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.metrics.detail.currentValue")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {metric.environment.displayValue}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {metricSampleText(t, metric, "changeLabel")}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.metrics.dataStatus")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataStatusBadge status={metric.environment.dataStatus} />
            <p className="mt-2 text-xs text-muted-foreground">
              {t("releaseHealth.metrics.detail.inEnvironment", {
                environment: context?.envName ?? "Environment",
              })}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.metrics.detail.coverage")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {metric.environment.coverage}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("releaseHealth.metrics.detail.selectedWindow")}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.metrics.freshness")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold">
              {metricSampleText(t, metric, "updatedAt")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("releaseHealth.metrics.detail.latestSample")}
            </p>
          </CardContent>
        </Card>
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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.6fr)]">
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
            <div className="grid gap-3 px-4 md:hidden">
              {monitorRows.map((row) => (
                <div key={row.flagKey} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
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
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {row.flagKey}
                      </p>
                    </div>
                    <HealthStatusBadge status={row.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <PurposeBadge purpose={row.purpose} />
                    <span className="text-sm">
                      {ruleSampleText(t, row.rule)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">
                      {t("releaseHealth.metrics.detail.monitor")}
                    </TableHead>
                    <TableHead>
                      {t("releaseHealth.metrics.detail.use")}
                    </TableHead>
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
                    <TableRow key={row.flagKey}>
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("releaseHealth.metrics.detail.sourceTitle")}
            </CardTitle>
            <CardDescription>
              {t("releaseHealth.metrics.detail.sourceDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4 text-sm">
              {[
                [t("releaseHealth.metrics.source"), metric.source],
                [t("releaseHealth.metrics.sourceEvent"), metric.sourceEvent],
                [t("releaseHealth.metrics.aggregation"), metric.aggregation],
                [t("releaseHealth.metrics.unit"), metric.unit],
                [
                  t("releaseHealth.metrics.detail.environment"),
                  context?.envName ?? "Environment",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="max-w-56 text-right font-medium break-words">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
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
