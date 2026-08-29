import {
  Activity,
  BellRing,
  CalendarClock,
  ChevronRight,
  Play,
  Settings2,
  ShieldAlert,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"
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
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FeatureFlag } from "@/features/flags/flags-types"
import {
  getCurrentProjectEnv,
  localizedPath,
} from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { MonitorConfigurationSheet } from "../components/monitor-configuration-sheet"
import {
  DataStatusBadge,
  GateStatusBadge,
  HealthStatusBadge,
  ObservationScopeBadge,
  PurposeBadge,
} from "../components/status-badges"
import {
  metricSampleText,
  ruleSampleText,
  sessionSampleText,
} from "../release-health-display"
import {
  checkoutMonitor,
  healthSessions,
  metricById,
} from "../release-health-mock-data"

type OpenSheet = "monitor" | "quick" | "change" | null

export function FlagReleaseHealthTab({
  flag,
  lang,
}: {
  envId: string
  flag: FeatureFlag
  lang: Lang
}) {
  const { t } = useTranslation()
  const context = getCurrentProjectEnv()
  const [monitorEnabled, setMonitorEnabled] = useState(checkoutMonitor.enabled)
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null)
  const flagSessions = healthSessions.slice(0, 2)
  const monitorName = t("releaseHealth.flag.monitorName", {
    flag: flag.name,
  })

  function sessionPreviewHref(sessionId: string) {
    const searchParams = new URLSearchParams({
      flagKey: flag.key,
      previewSession: sessionId,
    })

    return localizedPath(lang, `/release-health/sessions?${searchParams}`)
  }

  function toggleMonitor(enabled: boolean) {
    setMonitorEnabled(enabled)
    toast.success(
      t(
        enabled
          ? "releaseHealth.flag.monitorResumed"
          : "releaseHealth.flag.monitorPaused"
      )
    )
  }

  return (
    <div className="space-y-5 pt-5">
      <Alert>
        <Activity />
        <AlertDescription>
          {t("releaseHealth.flag.correlationNotice")}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {t("releaseHealth.flag.title")}
            </h2>
            <Badge variant="outline">{t("releaseHealth.designPreview")}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("releaseHealth.flag.description", {
              environment: context?.envName ?? "Environment",
            })}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">{flag.name}</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {flag.key}
            </code>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpenSheet("change")}
          >
            <CalendarClock />
            {t("releaseHealth.flag.monitorThisChange")}
          </Button>
          <Button type="button" onClick={() => setOpenSheet("quick")}>
            <Play />
            {t("releaseHealth.flag.quickObservation")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{monitorName}</CardTitle>
          <CardDescription>
            {t("releaseHealth.flag.monitorDescription")}
          </CardDescription>
          <CardAction className="col-span-full row-start-3 flex flex-wrap items-center gap-3 justify-self-start sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-self-end">
            <span className="text-xs text-muted-foreground">
              {monitorEnabled
                ? t("releaseHealth.flag.monitoring")
                : t("releaseHealth.flag.paused")}
            </span>
            <Switch
              checked={monitorEnabled}
              aria-label={t("releaseHealth.flag.toggleMonitor")}
              onCheckedChange={toggleMonitor}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenSheet("monitor")}
            >
              <Settings2 />
              {t("releaseHealth.flag.configure")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {t("releaseHealth.flag.currentGate")}
              </p>
              <div className="mt-2">
                <GateStatusBadge status="approval-required" />
              </div>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {t("releaseHealth.flag.activeSessions")}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">1</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {t("releaseHealth.flag.bindings")}
              </p>
              <p className="mt-1 text-sm font-medium">
                {t("releaseHealth.flag.bindingSummary", {
                  guards: 3,
                  observes: 1,
                })}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                {t("releaseHealth.flag.triggers")}
              </p>
              <p className="mt-1 text-sm font-medium">
                {t("releaseHealth.flag.triggerSummary")}
              </p>
            </div>
          </div>
          {!monitorEnabled ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {t("releaseHealth.flag.pauseNotice")}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("releaseHealth.flag.metricsTitle")}</CardTitle>
            <CardDescription>
              {t("releaseHealth.flag.metricsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="grid gap-3 px-4 md:hidden">
              {checkoutMonitor.bindings.map((binding) => {
                const metric = metricById(binding.metricId)
                if (!metric) return null
                return (
                  <div key={binding.metricId} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={localizedPath(
                            lang,
                            `/release-health/metrics/${metric.key}`
                          )}
                          className="font-medium hover:underline"
                        >
                          {metricSampleText(t, metric, "name")}
                        </Link>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {metric.key} · v{metric.version}
                        </p>
                      </div>
                      <HealthStatusBadge status={binding.healthStatus} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ObservationScopeBadge scope={metric.observationScope} />
                      <PurposeBadge purpose={binding.purpose} />
                      <DataStatusBadge status={metric.environment.dataStatus} />
                    </div>
                    <p className="mt-3 border-t pt-3 text-sm">
                      {ruleSampleText(t, binding.rule)}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">
                      {t("releaseHealth.metrics.metric")}
                    </TableHead>
                    <TableHead>
                      {t("releaseHealth.metrics.scopeColumn")}
                    </TableHead>
                    <TableHead>{t("releaseHealth.flag.use")}</TableHead>
                    <TableHead>{t("releaseHealth.flag.rule")}</TableHead>
                    <TableHead>{t("releaseHealth.sessions.data")}</TableHead>
                    <TableHead className="pr-4">
                      {t("releaseHealth.flag.assessment")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkoutMonitor.bindings.map((binding) => {
                    const metric = metricById(binding.metricId)
                    if (!metric) return null
                    return (
                      <TableRow key={binding.metricId}>
                        <TableCell className="pl-4">
                          <Link
                            to={localizedPath(
                              lang,
                              `/release-health/metrics/${metric.key}`
                            )}
                            className="font-medium hover:underline"
                          >
                            {metricSampleText(t, metric, "name")}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">
                            {metric.key} · v{metric.version}
                          </p>
                        </TableCell>
                        <TableCell>
                          <ObservationScopeBadge
                            scope={metric.observationScope}
                          />
                        </TableCell>
                        <TableCell>
                          <PurposeBadge purpose={binding.purpose} />
                        </TableCell>
                        <TableCell>{ruleSampleText(t, binding.rule)}</TableCell>
                        <TableCell>
                          <DataStatusBadge
                            status={metric.environment.dataStatus}
                          />
                        </TableCell>
                        <TableCell className="pr-4">
                          <HealthStatusBadge status={binding.healthStatus} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("releaseHealth.flag.activeSessionTitle")}</CardTitle>
            <CardDescription>
              {t("releaseHealth.flag.activeSessionDescription")}
            </CardDescription>
            <CardAction className="col-span-full row-start-3 justify-self-start sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-self-end">
              <Button
                nativeButton={false}
                variant="ghost"
                size="sm"
                render={<Link to={sessionPreviewHref(flagSessions[0].id)} />}
              >
                {t("releaseHealth.flag.openSession")}
                <ChevronRight />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">HS-042</Badge>
              <GateStatusBadge status="approval-required" />
              <DataStatusBadge status="ready" />
            </div>
            <div>
              <p className="text-sm font-medium">{flag.name}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {flag.key} · {flag.revision ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">
                {t("releaseHealth.flag.sampleChange")}
              </p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <ShieldAlert className="size-4" />
                {t("releaseHealth.flag.observedAnomaly")}
              </div>
              {t("releaseHealth.flag.observedAnomalyHelp")}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BellRing className="size-4" />
              {t("releaseHealth.flag.alertDelivery")}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("releaseHealth.flag.historyTitle")}</CardTitle>
          <CardDescription>
            {t("releaseHealth.flag.historyDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid gap-3 px-4 md:hidden">
            {flagSessions.map((session) => (
              <div key={session.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={sessionPreviewHref(session.id)}
                    className="font-medium hover:underline"
                  >
                    {session.displayId}
                  </Link>
                  <GateStatusBadge status={session.gateStatus} />
                </div>
                <p className="mt-2 text-sm">
                  {flag.name}: {sessionSampleText(t, session, "changeSummary")}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {flag.key} · {flag.revision ?? "—"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <DataStatusBadge status={session.dataStatus} />
                  <Badge variant="outline" className="font-normal">
                    {sessionSampleText(t, session, "triggerLabel")}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(
                      lang === "zh" ? "zh-CN" : "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    ).format(new Date(session.startedAt))}
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
                    {t("releaseHealth.sessions.session")}
                  </TableHead>
                  <TableHead>{t("releaseHealth.sessions.trigger")}</TableHead>
                  <TableHead>{t("releaseHealth.sessions.change")}</TableHead>
                  <TableHead>{t("releaseHealth.sessions.data")}</TableHead>
                  <TableHead>{t("releaseHealth.sessions.gate")}</TableHead>
                  <TableHead className="pr-4 text-right">
                    {t("releaseHealth.sessions.started")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flagSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="pl-4">
                      <Link
                        to={sessionPreviewHref(session.id)}
                        className="font-medium hover:underline"
                      >
                        {session.displayId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {sessionSampleText(t, session, "triggerLabel")}
                    </TableCell>
                    <TableCell>
                      <p>
                        {flag.name}:{" "}
                        {sessionSampleText(t, session, "changeSummary")}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {flag.key} · {flag.revision ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <DataStatusBadge status={session.dataStatus} />
                    </TableCell>
                    <TableCell>
                      <GateStatusBadge status={session.gateStatus} />
                    </TableCell>
                    <TableCell className="pr-4 text-right text-muted-foreground">
                      {new Intl.DateTimeFormat(
                        lang === "zh" ? "zh-CN" : "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      ).format(new Date(session.startedAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <MonitorConfigurationSheet
        key={openSheet ?? "closed"}
        open={Boolean(openSheet)}
        variant={openSheet ?? "monitor"}
        flagName={flag.name}
        flagKey={flag.key}
        environmentName={context?.envName ?? "Environment"}
        revision={flag.revision}
        onOpenChange={(open) => !open && setOpenSheet(null)}
      />
    </div>
  )
}
