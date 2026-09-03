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
import { LiveTrendChart } from "./live-metric-panel"
import {
  useLiveMetrics,
  useMetricReadings,
  metricValue,
} from "./live-metric-data"
import { useEnvironmentStreams } from "./live-environment-streams"
import type { LiveMetric } from "../release-health-api"
import type { ProjectEnv } from "@/features/layout/layout-types"
import { DataStatusBadge } from "../components/status-badges"
import { metricResultProfileLabel, metricUnitLabel } from "./metric-contract"

export function ReleaseMetricDetailsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const context = getCurrentProjectEnv()
  const metrics = useLiveMetrics(context?.projectId ?? "")
  const metric = metrics.data?.find((item) => item.key === params.metricKey)
  if (metrics.isPending || metrics.isError)
    return (
      <Alert variant={metrics.isError ? "destructive" : "default"}>
        <AlertDescription>
          {t(
            metrics.isError
              ? "releaseHealth.live.loadFailed"
              : "releaseHealth.live.loading"
          )}
        </AlertDescription>
      </Alert>
    )
  if (metric && context)
    return (
      <MetricDetails
        key={context.projectId + metric.id}
        definition={metric}
        context={context}
      />
    )

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

  return null
}

function MetricDetails({
  definition,
  context,
}: {
  definition: LiveMetric
  context: ProjectEnv
}) {
  const { t } = useTranslation()
  const lang = resolveLang(useParams().lang)
  const [range, setRange] = useState("1h")
  const reading = useMetricReadings(context, [definition], 60)[0]
  const currentBinding =
    reading.data?.status !== "not_connected" && Boolean(reading.data)
  const point = reading.data?.points.at(-1)
  const metric = {
    ...definition,
    environment: {
      dataStatus: reading.isError
        ? ("error" as const)
        : reading.data?.status === "stale"
          ? ("stale" as const)
          : reading.data?.status === "no_data"
            ? ("no-data" as const)
            : ("ready" as const),
      displayValue: point ? metricValue(definition, point.value) : "—",
      history: reading.data?.points ?? [],
      updatedAt: point ? new Date(point.timestamp).toLocaleString() : "—",
    },
  }
  const streams = useEnvironmentStreams(context, definition)
  const environmentRows = streams.rows
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
              {metric.name}
            </h1>
            <Badge variant="secondary">v{metric.version}</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {metric.description || "—"}
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
        <Button
          variant="outline"
          size="sm"
          disabled
          title={t("releaseHealth.live.versionsUnavailable")}
        >
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
          {streams.pending || streams.failed ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {t(
                streams.failed
                  ? "releaseHealth.live.loadFailed"
                  : "releaseHealth.live.loading"
              )}
            </p>
          ) : null}
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
                    {row.pending ? (
                      <Badge variant="outline">
                        {t("releaseHealth.live.loading")}
                      </Badge>
                    ) : row.dataStatus ? (
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
                      disabled={!row.canConfigure}
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
          help={t("releaseHealth.live.onDemand")}
        />
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.metrics.dataStatus")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reading.isPending ? (
              <Badge variant="outline">{t("releaseHealth.live.loading")}</Badge>
            ) : reading.isError ? (
              <DataStatusBadge status="error" />
            ) : currentBinding ? (
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
          value={
            reading.isPending || reading.isError
              ? "—"
              : String(metric.environment.history.length)
          }
          help={t("releaseHealth.metrics.detail.managementWindow")}
        />
        <FactCard
          label={t("releaseHealth.metrics.freshness")}
          value={metric.environment.updatedAt}
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
                  <SelectItem value="6h" disabled>
                    {t("releaseHealth.metrics.detail.lastSixHours")}
                  </SelectItem>
                  <SelectItem value="24h" disabled>
                    {t("releaseHealth.metrics.detail.lastDay")}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("releaseHealth.live.rangeUnavailable")}{" "}
            {t("releaseHealth.live.syncUnavailable")}
          </p>
          {reading.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {t("releaseHealth.live.queryFailed")}
              </AlertDescription>
            </Alert>
          ) : reading.data ? (
            <LiveTrendChart
              trend={reading.data}
              fractionDigits={metric.fractionDigits ?? 2}
            />
          ) : (
            <p>{t("releaseHealth.live.loading")}</p>
          )}
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
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t("releaseHealth.live.relatedUnavailable")}
                  </TableCell>
                </TableRow>
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
            <p className="text-xs text-muted-foreground">
              {t("releaseHealth.live.versionsUnavailable")}
            </p>
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
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>
            {t("releaseHealth.metrics.detail.sessionMarkers")}
          </CardTitle>
          <CardDescription>
            {t("releaseHealth.metrics.detail.sessionMarkersDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("releaseHealth.live.relatedUnavailable")}
          </p>
        </CardContent>
      </Card>
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
