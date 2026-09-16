import { Settings2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
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
  HealthStatusBadge,
  ObservationModeBadge,
  PurposeBadge,
} from "../components/status-badges"
import { metricSampleText, ruleSampleText } from "../release-health-display"
import { checkoutMonitor, metricById } from "../release-health-mock-data"

import { formatMetricValue } from "../metrics/metric-contract"
import type { MonitorBinding, ReleaseMetric } from "../release-health-types"

export function FlagReleaseHealthTab({
  envId,
  flag,
  lang,
}: {
  envId: string
  flag: FeatureFlag
  lang: Lang
}) {
  const { t } = useTranslation()
  const context = getCurrentProjectEnv()
  const { hash } = useLocation()
  const bindingsSection = useRef<HTMLElement>(null)
  useEffect(() => {
    if (hash === "#metric-bindings") {
      bindingsSection.current?.scrollIntoView?.({ block: "start" })
    }
  }, [hash, flag.id])
  const [monitorEnabled, setMonitorEnabled] = useState(checkoutMonitor.enabled)
  const [monitorOpen, setMonitorOpen] = useState(false)
  const monitorName = t("releaseHealth.flag.monitorName", {
    flag: flag.name,
  })

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
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {monitorName}
            <Badge variant="outline">{t("releaseHealth.designPreview")}</Badge>
          </CardTitle>
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
              onClick={() => setMonitorOpen(true)}
            >
              <Settings2 />
              {t("releaseHealth.flag.configure")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm text-muted-foreground">
              {t("releaseHealth.flag.bindings")}
            </span>
            <span className="text-sm font-medium">
              {t("releaseHealth.flag.bindingSummary", {
                guards: checkoutMonitor.bindings.filter(
                  (binding) => binding.purpose === "guard"
                ).length,
                observes: checkoutMonitor.bindings.filter(
                  (binding) => binding.purpose === "observe"
                ).length,
              })}
            </span>
          </div>
          {!monitorEnabled ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {t("releaseHealth.flag.pauseNotice")}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section
        id="metric-bindings"
        ref={bindingsSection}
        className="scroll-mt-5"
      >
        <Card>
          <CardHeader>
            <CardTitle>{t("releaseHealth.flag.metricsTitle")}</CardTitle>
            <CardDescription>
              {t("releaseHealth.flag.metricsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="grid grid-cols-1 gap-3 px-4 md:hidden">
              {checkoutMonitor.bindings.map((binding) => {
                const metric = metricById(binding.metricId)
                if (!metric) return null
                return (
                  <div key={binding.metricId} className="rounded-md border p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                      <LatestRuleCheck
                        binding={binding}
                        metric={metric}
                        lang={lang}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ObservationModeBadge mode={binding.observationMode} />
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
                    <TableHead>
                      {t("releaseHealth.metrics.dataStatus")}
                    </TableHead>
                    <TableHead className="pr-4">
                      {t("releaseHealth.flag.latestRuleCheck")}
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
                          <ObservationModeBadge
                            mode={binding.observationMode}
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
                          <LatestRuleCheck
                            binding={binding}
                            metric={metric}
                            lang={lang}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <MonitorConfigurationSheet
        key={`${envId}:${flag.id}:${monitorOpen}`}
        open={monitorOpen}
        monitoringEnabled={monitorEnabled}
        flagName={flag.name}
        flagKey={flag.key}
        environmentName={context?.envName ?? "Environment"}
        onOpenChange={setMonitorOpen}
      />
    </div>
  )
}

function LatestRuleCheck({
  binding,
  metric,
  lang,
}: {
  binding: MonitorBinding
  metric: ReleaseMetric
  lang: Lang
}) {
  const { t } = useTranslation()
  if (binding.purpose === "observe") {
    return (
      <div className="space-y-1">
        <Badge variant="outline">
          {t("releaseHealth.status.notApplicable")}
        </Badge>
        <p className="text-xs text-muted-foreground">
          {t("releaseHealth.flag.observeOnly")}
        </p>
      </div>
    )
  }

  const check = binding.latestCheck
  const locale = lang === "zh" ? "zh-CN" : "en-US"
  return (
    <div className="space-y-1">
      <HealthStatusBadge
        status={
          check?.dataStatus === "ready" ? check.healthStatus : "not-evaluated"
        }
      />
      <p className="text-xs text-muted-foreground">
        {check ? (
          <>
            {check.dataStatus === "ready" && check.value !== null
              ? formatMetricValue(metric, check.value)
              : t(`releaseHealth.status.data.${check.dataStatus}`)}
            {" · "}
            <time
              dateTime={check.checkedAt}
              title={new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "long",
              }).format(new Date(check.checkedAt))}
            >
              {new Intl.DateTimeFormat(locale, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZoneName: "short",
              }).format(new Date(check.checkedAt))}
            </time>
          </>
        ) : (
          t("releaseHealth.flag.notChecked")
        )}
      </p>
    </div>
  )
}
