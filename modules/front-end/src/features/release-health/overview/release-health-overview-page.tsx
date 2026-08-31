import {
  Activity,
  ArrowRight,
  BellRing,
  Database,
  HeartPulse,
  ShieldAlert,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { ReleaseHealthShell } from "../components/release-health-shell"
import { DataStatusBadge, GateStatusBadge } from "../components/status-badges"
import { metricSampleText, sessionSampleText } from "../release-health-display"
import { healthSessions, releaseMetrics } from "../release-health-mock-data"

const summaryItems = [
  {
    key: "activeSessions",
    value: "2",
    icon: Activity,
  },
  {
    key: "needsAttention",
    value: "1",
    icon: ShieldAlert,
  },
  {
    key: "readyStreams",
    value: "3 / 5",
    icon: Database,
  },
  {
    key: "alertsToday",
    value: "4",
    icon: BellRing,
  },
] as const

export function ReleaseHealthOverviewPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const activeSessions = healthSessions.filter(
    (session) => session.status === "active"
  )
  const visibleMetrics = releaseMetrics.slice(0, 4)

  return (
    <ReleaseHealthShell activeTab="overview">
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.key} size="sm">
                <CardHeader>
                  <CardDescription>
                    {t(`releaseHealth.overview.summary.${item.key}`)}
                  </CardDescription>
                  <CardAction>
                    <Icon className="size-4 text-muted-foreground" />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight tabular-nums">
                    {item.value}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(`releaseHealth.overview.summaryHelp.${item.key}`)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t("releaseHealth.overview.activeTitle")}</CardTitle>
              <CardDescription>
                {t("releaseHealth.overview.activeDescription")}
              </CardDescription>
              <CardAction>
                <Button
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  render={
                    <Link
                      to={localizedPath(lang, "/release-health/sessions")}
                    />
                  }
                >
                  {t("releaseHealth.overview.viewAll")}
                  <ArrowRight />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              <div className="space-y-3 px-4 md:hidden">
                {activeSessions.map((session) => (
                  <Link
                    key={session.id}
                    to={localizedPath(
                      lang,
                      `/release-health/sessions/${session.id}`
                    )}
                    className="block rounded-md border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {sessionSampleText(t, session, "flagName")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.displayId} ·{" "}
                          {sessionSampleText(t, session, "triggerLabel")}
                        </p>
                      </div>
                      <GateStatusBadge status={session.gateStatus} />
                    </div>
                    <p className="mt-3 text-sm">
                      {sessionSampleText(t, session, "changeSummary")}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <DataStatusBadge status={session.dataStatus} />
                      <span className="text-xs text-muted-foreground">
                        {session.displayId === "HS-042"
                          ? t("releaseHealth.relativeTime.minutes", {
                              count: 26,
                            })
                          : t("releaseHealth.relativeTime.minutes", {
                              count: 7,
                            })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">
                        {t("releaseHealth.sessions.session")}
                      </TableHead>
                      <TableHead>
                        {t("releaseHealth.sessions.change")}
                      </TableHead>
                      <TableHead>{t("releaseHealth.sessions.data")}</TableHead>
                      <TableHead>{t("releaseHealth.sessions.gate")}</TableHead>
                      <TableHead className="pr-4 text-right">
                        {t("releaseHealth.sessions.started")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="pl-4">
                          <Link
                            to={localizedPath(
                              lang,
                              `/release-health/sessions/${session.id}`
                            )}
                            className="font-medium text-foreground hover:underline"
                          >
                            {sessionSampleText(t, session, "flagName")}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {session.displayId} ·{" "}
                            {sessionSampleText(t, session, "triggerLabel")}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-64 truncate">
                            {sessionSampleText(t, session, "changeSummary")}
                          </p>
                        </TableCell>
                        <TableCell>
                          <DataStatusBadge status={session.dataStatus} />
                        </TableCell>
                        <TableCell>
                          <GateStatusBadge status={session.gateStatus} />
                        </TableCell>
                        <TableCell className="pr-4 text-right text-muted-foreground">
                          {session.displayId === "HS-042"
                            ? t("releaseHealth.relativeTime.minutes", {
                                count: 26,
                              })
                            : t("releaseHealth.relativeTime.minutes", {
                                count: 7,
                              })}
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
              <CardTitle>{t("releaseHealth.overview.modelTitle")}</CardTitle>
              <CardDescription>
                {t("releaseHealth.overview.modelDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    icon: Database,
                    title: t("releaseHealth.overview.model.metricTitle"),
                    text: t("releaseHealth.overview.model.metricText"),
                  },
                  {
                    icon: HeartPulse,
                    title: t("releaseHealth.overview.model.monitorTitle"),
                    text: t("releaseHealth.overview.model.monitorText"),
                  },
                  {
                    icon: Activity,
                    title: t("releaseHealth.overview.model.sessionTitle"),
                    text: t("releaseHealth.overview.model.sessionText"),
                  },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="flex gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                {t("releaseHealth.overview.signalsTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("releaseHealth.overview.signalsDescription")}
              </p>
            </div>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={
                <Link to={localizedPath(lang, "/release-health/metrics")} />
              }
            >
              {t("releaseHealth.overview.exploreMetrics")}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleMetrics.map((metric) => (
              <Link
                key={metric.id}
                to={localizedPath(
                  lang,
                  `/release-health/metrics/${metric.key}`
                )}
                className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card
                  size="sm"
                  className="h-full transition-colors hover:bg-muted/20"
                >
                  <CardHeader>
                    <CardTitle className="truncate">
                      {metricSampleText(t, metric, "name")}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {metric.key}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <span className="text-2xl font-semibold tracking-tight tabular-nums">
                        {metric.environment.displayValue}
                      </span>
                      <DataStatusBadge status={metric.environment.dataStatus} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metricSampleText(t, metric, "changeLabel")} ·{" "}
                      {metricSampleText(t, metric, "updatedAt")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`releaseHealth.valueType.${metric.valueType}`)} ·{" "}
                      {metric.environment.sourceBinding
                        ? t(
                            `releaseHealth.metrics.sources.${metric.environment.sourceBinding.sourceType}`
                          )
                        : t("releaseHealth.metrics.detail.notConnected")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </ReleaseHealthShell>
  )
}
