import { BindingMetricStatus } from "./binding-metric-status"
import { Plus } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { MetricBindingSheet } from "./metric-binding-sheet"
import { BindingConfirmation } from "./binding-confirmation"
import { BindingActions, BindingRuleSummary } from "./binding-row-content"
import { useBindingWebhooks } from "./binding-webhooks"
import { ApiRequestError } from "@/lib/api/authenticated-api"
import {
  monitorApi,
  monitorBindingWrite,
  type LiveMonitor,
  type LiveMonitorBinding,
} from "./monitor-api"
import {
  monitorQueryKey,
  useMonitorMetrics,
  type BindingMetric,
} from "./monitor-data"
import {
  HealthStatusBadge,
  ObservationModeBadge,
  PurposeBadge,
} from "../components/status-badges"

import { formatMetricValue } from "../metrics/metric-contract"
import type { BindingAlertRule, MonitorBinding } from "../release-health-types"

type FlagHealthProps = {
  envId: string
  flag: FeatureFlag
  lang: Lang
  canManage?: boolean
}

export function FlagReleaseHealthTab(props: FlagHealthProps) {
  const projectId = getCurrentProjectEnv()?.projectId ?? ""
  return (
    <FlagBindingsContent
      key={monitorQueryKey(
        { projectId, envId: props.envId },
        props.flag.id
      ).join(":")}
      {...props}
    />
  )
}

function FlagBindingsContent({
  envId,
  flag,
  lang,
  canManage = true,
}: FlagHealthProps) {
  const { t } = useTranslation()
  const context = getCurrentProjectEnv()
  const { hash } = useLocation()
  const bindingsSection = useRef<HTMLElement>(null)
  useEffect(() => {
    if (hash === "#metric-bindings") {
      bindingsSection.current?.scrollIntoView?.({ block: "start" })
    }
  }, [hash, flag.id])
  const scope = { projectId: context?.projectId ?? "", envId }
  const client = useQueryClient()
  const queryKey = monitorQueryKey(scope, flag.id)
  const monitor = useQuery({
    queryKey,
    queryFn: () => monitorApi.get(scope, flag.id),
    enabled: Boolean(scope.projectId && envId && flag.id),
    retry: false,
  })
  const monitorEnabled = monitor.data?.enabled ?? false
  const bindings = monitor.data?.bindings ?? []
  const catalog = useMonitorMetrics(scope, flag.id, bindings)
  const metricById = (id: string) =>
    catalog.metrics.find((metric) => metric.id === id)
  const [editor, setEditor] = useState<{
    binding: LiveMonitorBinding | "add"
    revision: number
  } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<{
    binding: LiveMonitorBinding
    revision: number
  } | null>(null)
  const webhooks = useBindingWebhooks(context?.projectId ?? "", envId)
  const b = (key: string) => t("releaseHealth.binding." + key)
  const mutation = useMutation({
    mutationFn: (save: () => Promise<LiveMonitor>) => save(),
    onMutate: () => client.cancelQueries({ queryKey, exact: true }),
    onSuccess: async (saved) => {
      await client.cancelQueries({ queryKey, exact: true })
      client.setQueryData(queryKey, saved)
      void client.invalidateQueries({
        queryKey: ["release-health", scope.projectId, envId],
      })
    },
    onError: (error) => {
      const conflict = error instanceof ApiRequestError && error.status === 409
      toast.error(b(conflict ? "conflict" : "serverSaveError"))
      if (conflict) void monitor.refetch()
    },
  })
  const writable = canManage && monitor.isSuccess && !mutation.isPending
  async function persist(save: () => Promise<LiveMonitor>) {
    if (!writable) return false
    try {
      await mutation.mutateAsync(save)
      return true
    } catch {
      return false
    }
  }
  const actions = (binding: LiveMonitorBinding, metric: BindingMetric) => (
    <BindingActions
      disabled={!writable}
      binding={binding}
      metricName={metric.name}
      onEdit={() => setEditor({ binding, revision: monitor.data!.revision })}
      onRemove={() =>
        setRemoveTarget({ binding, revision: monitor.data!.revision })
      }
      onToggle={() =>
        void persist(() =>
          monitorApi.toggleBinding(scope, flag.id, binding.id, {
            expectedRevision: monitor.data!.revision,
            enabled: !binding.enabled,
          })
        )
      }
    />
  )
  const status = (binding: MonitorBinding) =>
    !monitorEnabled || !binding.enabled ? (
      <Badge variant="outline">{t("releaseHealth.flag.paused")}</Badge>
    ) : null
  async function saveBinding(next: MonitorBinding) {
    if (!editor) return
    if (
      editor.binding === "add" &&
      bindings.some((item) => item.metricId === next.metricId)
    ) {
      toast.error(b("duplicate"))
      return
    }
    const metricVersionId =
      editor.binding === "add"
        ? metricById(next.metricId)?.metricVersionId
        : editor.binding.metricVersionId
    if (!metricVersionId) return
    const write = monitorBindingWrite(next, metricVersionId, editor.revision)
    const target = editor.binding
    if (
      !(await persist(() =>
        target === "add"
          ? monitorApi.add(scope, flag.id, write)
          : monitorApi.edit(scope, flag.id, target.id, write)
      ))
    )
      return
    setEditor(null)
    toast.success(b("savedServer"))
  }
  const monitorName = t("releaseHealth.flag.monitorName", {
    flag: flag.name,
  })

  async function toggleMonitor(enabled: boolean) {
    if (
      !(await persist(() =>
        monitorApi.toggle(scope, flag.id, {
          expectedRevision: monitor.data!.revision,
          enabled,
        })
      ))
    )
      return
    toast.success(b(enabled ? "monitorEnabled" : "monitorPaused"))
  }

  return (
    <div className="space-y-5 pt-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {monitorName}
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
              disabled={!writable}
              aria-label={t("releaseHealth.flag.toggleMonitor")}
              onCheckedChange={toggleMonitor}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!writable || !catalog.isSuccess}
              onClick={() =>
                setEditor({ binding: "add", revision: monitor.data!.revision })
              }
            >
              <Plus />
              {b("add")}
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
                guards: bindings.filter(
                  (binding) => binding.purpose === "guard"
                ).length,
                trends: bindings.filter(
                  (binding) => binding.purpose === "trend"
                ).length,
              })}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {b("serverNotice")}
          </p>
          {monitor.isPending && (
            <p className="mt-3 text-sm text-muted-foreground">{b("loading")}</p>
          )}
          {(monitor.isError || catalog.isError) && (
            <div role="alert" className="mt-3 text-sm text-destructive">
              <p>{b(monitor.isError ? "serverLoadError" : "catalogError")}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  void monitor.refetch()
                  void catalog.refetch()
                }}
              >
                {b("retry")}
              </Button>
            </div>
          )}
          {monitor.isSuccess && !monitorEnabled ? (
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
            {monitor.isSuccess && bindings.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {b("empty")}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 px-4 md:hidden">
              {bindings.map((binding) => {
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
                          {metric.name}
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
                      {status(binding)}
                      <BindingMetricStatus metric={metric} />
                    </div>
                    <div className="mt-3 border-t pt-3 text-sm">
                      <BindingRuleSummary
                        binding={binding}
                        metric={metric}
                        webhooks={webhooks.data ?? []}
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      {actions(binding, metric)}
                    </div>
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
                    <TableHead>
                      {t("releaseHealth.flag.latestRuleCheck")}
                    </TableHead>
                    <TableHead className="pr-4 text-right">
                      {b("actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bindings.map((binding) => {
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
                            {metric.name}
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
                          {status(binding)}
                        </TableCell>
                        <TableCell>
                          <BindingRuleSummary
                            binding={binding}
                            metric={metric}
                            webhooks={webhooks.data ?? []}
                          />
                        </TableCell>
                        <TableCell>
                          <BindingMetricStatus metric={metric} />
                        </TableCell>
                        <TableCell>
                          <LatestRuleCheck
                            binding={binding}
                            metric={metric}
                            lang={lang}
                          />
                        </TableCell>
                        <TableCell className="pr-4">
                          {actions(binding, metric)}
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

      {editor !== null && (
        <MetricBindingSheet
          binding={editor.binding === "add" ? undefined : editor.binding}
          bindings={bindings}
          metrics={catalog.metrics}
          monitoringEnabled={monitorEnabled}
          flagName={flag.name}
          flagKey={flag.key}
          environmentName={context?.envName ?? "Environment"}
          projectId={context?.projectId ?? ""}
          envId={envId}
          lang={lang}
          webhooks={webhooks}
          onClose={() => setEditor(null)}
          onSave={saveBinding}
        />
      )}
      <BindingConfirmation
        open={removeTarget !== null}
        title={b("removeTitle")}
        description={t("releaseHealth.binding.removeDescription", {
          metric: removeTarget ? removeTarget.binding.metric.name : "",
        })}
        confirm={b("remove")}
        pending={mutation.isPending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return
          void persist(() =>
            monitorApi.remove(
              scope,
              flag.id,
              removeTarget.binding.id,
              removeTarget.revision
            )
          ).then((saved) => {
            if (!saved) return
            setRemoveTarget(null)
            toast.success(b("removedServer"))
          })
        }}
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
  metric: BindingMetric
  lang: Lang
}) {
  const { t } = useTranslation()
  if (binding.purpose === "trend") {
    return (
      <div className="space-y-1">
        <Badge variant="outline">
          {t("releaseHealth.status.notApplicable")}
        </Badge>
        <p className="text-xs text-muted-foreground">
          {t("releaseHealth.flag.trendOnly")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {binding.rules.map((rule) => (
        <div key={rule.id} className="space-y-1">
          {binding.rules.length > 1 && (
            <p className="text-xs font-medium">{rule.name}</p>
          )}
          <RuleCheck rule={rule} metric={metric} lang={lang} />
        </div>
      ))}
    </div>
  )
}

function RuleCheck({
  rule,
  metric,
  lang,
}: {
  rule: BindingAlertRule
  metric: BindingMetric
  lang: Lang
}) {
  const { t } = useTranslation()
  const check = rule.latestCheck
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
