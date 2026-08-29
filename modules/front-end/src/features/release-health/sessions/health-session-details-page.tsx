import {
  BellRing,
  Check,
  CirclePause,
  Clock3,
  FileClock,
  Info,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DetailBackLink } from "@/components/detail-back-link"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { cn } from "@/lib/utils"
import { MetricTrendChart } from "../components/metric-trend-chart"
import {
  DataStatusBadge,
  GateStatusBadge,
  HealthStatusBadge,
  ObservationScopeBadge,
  PurposeBadge,
} from "../components/status-badges"
import {
  actionSampleText,
  assessmentSampleText,
  eventSampleText,
  metricSampleText,
  noDataPolicySampleText,
  ruleSampleText,
  sessionSampleText,
} from "../release-health-display"
import { metricById, sessionById } from "../release-health-mock-data"

const thresholds: Record<string, number> = {
  "metric-error-rate": 2,
  "metric-api-latency": 800,
  "metric-memory": 85,
}

export function HealthSessionDetailsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const session = sessionById(decodeURIComponent(params.sessionId ?? ""))
  const [selectedMetricId, setSelectedMetricId] = useState(
    session?.assessments[0]?.metricId ?? ""
  )

  if (!session) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t("releaseHealth.sessions.detail.notFound")}
          </p>
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <Link to={localizedPath(lang, "/release-health/sessions")} />
            }
          >
            {t("releaseHealth.sessions.detail.back")}
          </Button>
        </div>
      </div>
    )
  }

  const selectedAssessment =
    session.assessments.find(
      (assessment) => assessment.metricId === selectedMetricId
    ) ?? session.assessments[0]
  const selectedMetric = selectedAssessment
    ? metricById(selectedAssessment.metricId)
    : undefined

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <DetailBackLink to={localizedPath(lang, "/release-health/sessions")}>
        {t("releaseHealth.tabs.sessions")}
      </DetailBackLink>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">
              {t("releaseHealth.sessions.detail.title", {
                id: session.displayId,
              })}
            </h1>
            <Badge variant="secondary">
              {t(`releaseHealth.sessions.status.${session.status}`)}
            </Badge>
            <GateStatusBadge status={session.gateStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            {sessionSampleText(t, session, "monitorName")} ·{" "}
            {sessionSampleText(t, session, "flagName")} ·{" "}
            {sessionSampleText(t, session, "triggerLabel")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success(t("releaseHealth.sessions.detail.acknowledged"))
            }
          >
            <Check />
            {t("releaseHealth.sessions.detail.acknowledge")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success(t("releaseHealth.sessions.detail.stopPreview"))
            }
          >
            <CirclePause />
            {t("releaseHealth.sessions.detail.stop")}
          </Button>
        </div>
      </header>

      <Alert className="mb-5 border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30">
        <TriangleAlert className="text-amber-700 dark:text-amber-300" />
        <AlertTitle>
          {t("releaseHealth.sessions.detail.correlationTitle")}
        </AlertTitle>
        <AlertDescription>
          {t("releaseHealth.sessions.detail.correlationNotice")}
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.sessions.gate")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <GateStatusBadge status={session.gateStatus} />
            <p className="text-xs text-muted-foreground">
              {t("releaseHealth.sessions.detail.gateReason")}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.sessions.data")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <DataStatusBadge status={session.dataStatus} />
            <p className="text-xs text-muted-foreground">
              {t("releaseHealth.sessions.detail.dataSummary", {
                ready: session.assessments.filter(
                  (assessment) => assessment.dataStatus === "ready"
                ).length,
                total: session.assessments.length,
              })}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.sessions.detail.changeContext")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {sessionSampleText(t, session, "changeSummary")}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {session.revisionBefore} → {session.revisionAfter}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              {t("releaseHealth.sessions.detail.observationWindow")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {session.snapshot.warmup} + {session.snapshot.lookback}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("releaseHealth.sessions.detail.every", {
                interval: session.snapshot.evaluationInterval,
              })}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("releaseHealth.sessions.detail.evidence")}</CardTitle>
            <CardDescription>
              {t("releaseHealth.sessions.detail.evidenceDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.assessments.map((assessment) => {
              const metric = metricById(assessment.metricId)
              const selected = assessment.metricId === selectedMetricId
              return (
                <button
                  key={assessment.metricId}
                  type="button"
                  className={cn(
                    "w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    selected && "border-foreground/30 bg-muted/50"
                  )}
                  onClick={() => setSelectedMetricId(assessment.metricId)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {metric
                          ? metricSampleText(t, metric, "name")
                          : assessment.metricId}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {assessment.observedValue} ·{" "}
                        {ruleSampleText(t, assessment.rule)}
                      </p>
                    </div>
                    <HealthStatusBadge status={assessment.healthStatus} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <DataStatusBadge status={assessment.dataStatus} />
                    <PurposeBadge purpose={assessment.purpose} />
                  </div>
                </button>
              )
            })}
            {!session.assessments.length ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t("releaseHealth.sessions.detail.noAssessments")}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {(selectedMetric &&
                metricSampleText(t, selectedMetric, "name")) ??
                t("releaseHealth.sessions.detail.selectMetric")}
            </CardTitle>
            <CardDescription>
              {(selectedAssessment &&
                assessmentSampleText(t, selectedAssessment, "reason")) ??
                t("releaseHealth.sessions.detail.selectMetricHelp")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedMetric && selectedAssessment ? (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <DataStatusBadge status={selectedAssessment.dataStatus} />
                  <HealthStatusBadge status={selectedAssessment.healthStatus} />
                  <ObservationScopeBadge
                    scope={selectedMetric.observationScope}
                  />
                  <Badge variant="outline" className="font-normal">
                    {assessmentSampleText(
                      t,
                      selectedAssessment,
                      "evidenceWindow"
                    )}
                  </Badge>
                </div>
                {selectedMetric.observationScope === "environment" ? (
                  <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
                    {t("releaseHealth.sessions.detail.environmentSignalNotice")}
                  </div>
                ) : null}
                <MetricTrendChart
                  metric={selectedMetric}
                  threshold={thresholds[selectedMetric.id]}
                  thresholdLabel={ruleSampleText(t, selectedAssessment.rule)}
                  sessionStartLabel={
                    selectedMetric.environment.history[14]?.label
                  }
                />
              </>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                {t("releaseHealth.sessions.detail.noEvidence")}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("releaseHealth.sessions.detail.timeline")}</CardTitle>
            <CardDescription>
              {t("releaseHealth.sessions.detail.timelineDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {session.events.length ? (
              <ol className="relative ml-2 border-l">
                {session.events.map((event) => (
                  <li key={event.id} className="relative pb-6 pl-6 last:pb-0">
                    <span
                      className={cn(
                        "absolute top-1 -left-1.5 size-3 rounded-full border-2 border-background",
                        event.result === "warning"
                          ? "bg-destructive"
                          : event.result === "pending"
                            ? "bg-amber-500"
                            : "bg-emerald-600"
                      )}
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">
                        {eventSampleText(t, event, "title")}
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {event.occurredAt}
                      </time>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {eventSampleText(t, event, "description")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("releaseHealth.sessions.detail.noTimeline")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("releaseHealth.sessions.detail.snapshot")}</CardTitle>
            <CardDescription>
              {t("releaseHealth.sessions.detail.snapshotDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="space-y-3 text-sm">
              {[
                [
                  t("releaseHealth.sessions.detail.created"),
                  new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(session.snapshot.createdAt)),
                ],
                [
                  t("releaseHealth.sessions.detail.warmup"),
                  session.snapshot.warmup,
                ],
                [
                  t("releaseHealth.sessions.detail.lookback"),
                  session.snapshot.lookback,
                ],
                [
                  t("releaseHealth.sessions.detail.evaluation"),
                  session.snapshot.evaluationInterval,
                ],
                [
                  t("releaseHealth.sessions.detail.sustain"),
                  session.snapshot.sustain,
                ],
                [
                  t("releaseHealth.sessions.detail.noData"),
                  noDataPolicySampleText(t, session.snapshot.noDataPolicy),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="max-w-52 text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                {t("releaseHealth.sessions.detail.metricVersions")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {session.snapshot.metricVersions.map((version) => (
                  <Badge
                    key={version}
                    variant="outline"
                    className="font-mono font-normal"
                  >
                    {version}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                {t("releaseHealth.sessions.detail.actions")}
              </p>
              <div className="space-y-2">
                {session.snapshot.actions.map((action) => (
                  <div key={action} className="flex items-center gap-2 text-sm">
                    {action.includes("Webhook") ? (
                      <BellRing className="size-4 text-muted-foreground" />
                    ) : action.includes("approval") ? (
                      <ShieldCheck className="size-4 text-muted-foreground" />
                    ) : (
                      <Info className="size-4 text-muted-foreground" />
                    )}
                    {actionSampleText(t, action)}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                render={
                  <Link
                    to={localizedPath(
                      lang,
                      `/feature-flags/${encodeURIComponent(
                        session.flagKey
                      )}/release-health`
                    )}
                  />
                }
              >
                <FileClock />
                {t("releaseHealth.sessions.detail.openFlag")}
              </Button>
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                render={
                  <Link
                    to={localizedPath(
                      lang,
                      `/audit-logs?query=${encodeURIComponent(session.id)}`
                    )}
                  />
                }
              >
                <Clock3 />
                {t("releaseHealth.sessions.detail.audit")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
