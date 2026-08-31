import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  Flag,
  Loader2,
  Pencil,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fetchFeatureFlag } from "@/features/flags/flags-api"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import {
  advanceExperimentToMeasuring,
  updateExperimentFlag,
  updateExperimentMetrics,
} from "../experiment-details-api"
import type { ExperimentDetail } from "../experiment-details-types"
import { ExperimentMetricsSheet } from "./experiment-metrics-sheet"
import {
  metricAggregationLabelKey,
  metricTypeLabelKey,
  parseGuardrails,
  parsePrimaryMetric,
  type SelectedMetric,
} from "./exposure-utils"
import { FeatureFlagSheet } from "./feature-flag-sheet"

function VariationIdCopy({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t(
              copied
                ? "releaseDecision.experiments.detailsPage.copied"
                : "releaseDecision.experiments.detailsPage.exposure.copyVariationId"
            )}
            onClick={() => {
              void navigator.clipboard.writeText(value).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1400)
              })
            }}
          />
        }
      >
        {copied ? <Check /> : <Copy />}
      </TooltipTrigger>
      <TooltipContent>
        {t(
          copied
            ? "releaseDecision.experiments.detailsPage.copied"
            : "releaseDecision.experiments.detailsPage.exposure.copyVariationId"
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function MetricRoleBadge({ role }: { role: "primary" | "guardrail" }) {
  const { t } = useTranslation()
  return (
    <Badge
      variant="outline"
      className={
        role === "primary"
          ? "border-violet-200 bg-violet-50 font-normal text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
          : "border-amber-200 bg-amber-50 font-normal text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
      }
    >
      {t(`releaseDecision.metrics.roles.${role}`)}
    </Badge>
  )
}

function MetricRow({
  metric,
  role,
}: {
  metric: SelectedMetric
  role: "primary" | "guardrail"
}) {
  const { t } = useTranslation()
  return (
    <TableRow>
      <TableCell className="px-4 py-3">
        <div className="space-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{metric.name}</span>
            <MetricRoleBadge role={role} />
          </div>
          <code className="text-xs text-muted-foreground">{metric.key}</code>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3">
        <div className="space-y-1">
          <p>
            {t(`releaseDecision.metrics.types.${metricTypeLabelKey(metric)}`)}
          </p>
          <p className="text-muted-foreground">
            {t(
              `releaseDecision.metrics.aggregations.${metricAggregationLabelKey(metric)}`,
              { defaultValue: metric.metricAgg }
            )}
          </p>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">
        {role === "primary"
          ? t(
              `releaseDecision.experiments.detailsPage.exposure.${metric.direction === "decrease_good" ? "lowerIsBetter" : "higherIsBetter"}`
            )
          : t(
              `releaseDecision.experiments.detailsPage.exposure.${metric.direction === "decrease_bad" ? "decreaseIsBad" : "increaseIsBad"}`
            )}
      </TableCell>
    </TableRow>
  )
}

function EmptyConfiguration({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: typeof Flag
  title: string
  description: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="flex min-h-28 items-center gap-5 rounded-lg border px-5 py-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted/20">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      <Button type="button" variant="outline" onClick={onAction}>
        {action}
      </Button>
    </div>
  )
}

export function ExposureDetails({
  experiment,
  envId,
  lang,
  onAdvanced,
}: {
  experiment: ExperimentDetail
  envId: string
  lang: Lang
  onAdvanced: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [flagSheetOpen, setFlagSheetOpen] = useState(false)
  const [metricsSheetOpen, setMetricsSheetOpen] = useState(false)
  const detailQueryKey = ["experiment-details", envId, experiment.id]
  const primary = parsePrimaryMetric(experiment.primaryMetric)
  const guardrails = parseGuardrails(experiment.guardrails)

  const flagQuery = useQuery({
    queryKey: ["experiment-feature-flag", envId, experiment.flagKey],
    queryFn: () => fetchFeatureFlag(envId, experiment.flagKey!),
    enabled: Boolean(envId && experiment.flagKey),
  })

  const flagMutation = useMutation({
    mutationFn: (flagKey: string) =>
      updateExperimentFlag(envId, experiment.id, flagKey),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailQueryKey, updated)
      setFlagSheetOpen(false)
      toast.success(
        t("releaseDecision.experiments.detailsPage.exposure.flagSheet.saved")
      )
    },
  })

  const metricsMutation = useMutation({
    mutationFn: (update: Parameters<typeof updateExperimentMetrics>[2]) =>
      updateExperimentMetrics(envId, experiment.id, update),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailQueryKey, updated)
      setMetricsSheetOpen(false)
      toast.success(
        t("releaseDecision.experiments.detailsPage.exposure.metricsSheet.saved")
      )
    },
  })

  const advanceMutation = useMutation({
    mutationFn: () => advanceExperimentToMeasuring(envId, experiment.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailQueryKey, updated)
      onAdvanced()
      toast.success(
        t("releaseDecision.experiments.detailsPage.exposure.advanced")
      )
    },
  })

  const ready = Boolean(experiment.flagKey && primary)
  const metrics = primary ? [primary, ...guardrails] : []

  return (
    <>
      <section className="rounded-lg border bg-background px-6 py-6">
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                {t(
                  "releaseDecision.experiments.detailsPage.exposure.featureFlag"
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  "releaseDecision.experiments.detailsPage.exposure.featureFlagHelp"
                )}
              </p>
            </div>

            {!experiment.flagKey ? (
              <EmptyConfiguration
                icon={Flag}
                title={t(
                  "releaseDecision.experiments.detailsPage.exposure.noFlag"
                )}
                description={t(
                  "releaseDecision.experiments.detailsPage.exposure.noFlagHelp"
                )}
                action={t(
                  "releaseDecision.experiments.detailsPage.exposure.selectFlag"
                )}
                onAction={() => setFlagSheetOpen(true)}
              />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <code className="max-w-md truncate rounded bg-muted px-2 py-1 text-sm">
                    {experiment.flagKey}
                  </code>
                  {flagQuery.data ? (
                    <Badge variant="outline" className="gap-2 font-normal">
                      <span
                        className={`size-2 rounded-full ${flagQuery.data.isEnabled ? "bg-emerald-600" : "bg-zinc-400"}`}
                      />
                      {t(
                        `releaseDecision.experiments.detailsPage.exposure.${flagQuery.data.isEnabled ? "on" : "off"}`
                      )}
                    </Badge>
                  ) : null}
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      nativeButton={false}
                      render={
                        <Link
                          to={localizedPath(
                            lang,
                            `/feature-flags/${encodeURIComponent(experiment.flagKey)}/targeting`
                          )}
                          target="_blank"
                        />
                      }
                      variant="ghost"
                    >
                      {t(
                        "releaseDecision.experiments.detailsPage.exposure.openTargeting"
                      )}
                      <ExternalLink />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFlagSheetOpen(true)}
                    >
                      {t(
                        "releaseDecision.experiments.detailsPage.exposure.changeFlag"
                      )}
                    </Button>
                  </div>
                </div>

                {flagQuery.isLoading ? (
                  <div className="space-y-px border-t">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-3 gap-6 px-4 py-3"
                      >
                        <Skeleton className="h-5 w-36" />
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-full" />
                      </div>
                    ))}
                  </div>
                ) : flagQuery.isError ? (
                  <div className="flex items-center justify-between gap-4 border-t px-4 py-4">
                    <p className="text-sm text-destructive">
                      {t(
                        "releaseDecision.experiments.detailsPage.exposure.flagLoadFailed"
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void flagQuery.refetch()}
                    >
                      {t("releaseDecision.experiments.retry")}
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[28%] px-4">
                          {t(
                            "releaseDecision.experiments.detailsPage.exposure.variation"
                          )}
                        </TableHead>
                        <TableHead className="w-[28%] px-4">
                          {t(
                            "releaseDecision.experiments.detailsPage.exposure.value"
                          )}
                        </TableHead>
                        <TableHead className="px-4">
                          {t(
                            "releaseDecision.experiments.detailsPage.exposure.variationId"
                          )}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(flagQuery.data?.variations ?? []).map((variation) => (
                        <TableRow key={variation.id}>
                          <TableCell className="px-4 py-3">
                            {variation.name}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <code className="rounded bg-muted px-2 py-1 text-xs">
                              {variation.value}
                            </code>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex min-w-72 items-center gap-3">
                              <code
                                className="min-w-0 flex-1 truncate text-xs"
                                title={variation.id}
                              >
                                {variation.id}
                              </code>
                              <VariationIdCopy value={variation.id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </section>

          <section className="space-y-4 pt-1">
            <div className="flex items-end justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                  {t(
                    "releaseDecision.experiments.detailsPage.exposure.metrics"
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "releaseDecision.experiments.detailsPage.exposure.metricsHelp"
                  )}
                </p>
              </div>
              {primary ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMetricsSheetOpen(true)}
                >
                  <Pencil />
                  {t(
                    "releaseDecision.experiments.detailsPage.exposure.editMetrics"
                  )}
                </Button>
              ) : null}
            </div>

            {!primary ? (
              <EmptyConfiguration
                icon={BarChart3}
                title={t(
                  "releaseDecision.experiments.detailsPage.exposure.noMetrics"
                )}
                description={t(
                  "releaseDecision.experiments.detailsPage.exposure.noMetricsHelp"
                )}
                action={t(
                  "releaseDecision.experiments.detailsPage.exposure.addMetrics"
                )}
                onAction={() => setMetricsSheetOpen(true)}
              />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[44%] px-4">
                        {t(
                          "releaseDecision.experiments.detailsPage.exposure.metric"
                        )}
                      </TableHead>
                      <TableHead className="w-[30%] px-4">
                        {t(
                          "releaseDecision.experiments.detailsPage.exposure.typeAggregation"
                        )}
                      </TableHead>
                      <TableHead className="px-4">
                        {t(
                          "releaseDecision.experiments.detailsPage.exposure.direction"
                        )}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((metric, index) => (
                      <MetricRow
                        key={`${metric.key}-${index}`}
                        metric={metric}
                        role={index === 0 ? "primary" : "guardrail"}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>

        <div className="mt-6 flex items-center justify-end gap-5">
          {advanceMutation.isError ? (
            <p className="text-sm text-destructive">
              {t(
                "releaseDecision.experiments.detailsPage.exposure.advanceFailed"
              )}
            </p>
          ) : !ready ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "releaseDecision.experiments.detailsPage.exposure.blockedHelp"
              )}
            </p>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="gap-2 px-3"
            disabled={!ready || advanceMutation.isPending}
            onClick={() => advanceMutation.mutate()}
          >
            {advanceMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : null}
            {t(
              advanceMutation.isPending
                ? "releaseDecision.experiments.detailsPage.exposure.advancing"
                : "releaseDecision.experiments.detailsPage.exposure.continue"
            )}
            {!advanceMutation.isPending ? <ArrowRight /> : null}
          </Button>
        </div>
      </section>

      {flagSheetOpen ? (
        <FeatureFlagSheet
          open
          envId={envId}
          currentFlagKey={experiment.flagKey}
          saving={flagMutation.isPending}
          saveError={flagMutation.isError}
          onOpenChange={setFlagSheetOpen}
          onConfirm={(flag) =>
            flagMutation.mutateAsync(flag.key).then(() => undefined)
          }
        />
      ) : null}
      {metricsSheetOpen ? (
        <ExperimentMetricsSheet
          open
          envId={envId}
          primary={primary}
          guardrails={guardrails}
          saving={metricsMutation.isPending}
          saveError={metricsMutation.isError}
          onOpenChange={setMetricsSheetOpen}
          onConfirm={(update) =>
            metricsMutation.mutateAsync(update).then(() => undefined)
          }
        />
      ) : null}
    </>
  )
}
