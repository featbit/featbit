import { BellRing, Database, HeartPulse, ShieldAlert } from "lucide-react"
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
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { ReleaseHealthShell } from "../components/release-health-shell"
import { DataStatusBadge } from "../components/status-badges"
import { metricSampleText } from "../release-health-display"
import { releaseMetrics } from "../release-health-mock-data"
import { metricResultProfileLabel } from "../metrics/metric-contract"

const summaryItems = [
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
  const visibleMetrics = releaseMetrics.slice(0, 4)

  return (
    <ReleaseHealthShell activeTab="overview">
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-3">
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

        <Card>
          <CardHeader>
            <CardTitle>{t("releaseHealth.overview.modelTitle")}</CardTitle>
            <CardDescription>
              {t("releaseHealth.overview.modelDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
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
                      {metricResultProfileLabel(t, metric)} ·{" "}
                      {metric.environment.sourceBinding
                        ? t(
                            "releaseHealth.metrics.sources.prometheusCompatible"
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
