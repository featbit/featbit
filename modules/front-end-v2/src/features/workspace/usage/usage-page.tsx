import { BarChart3, RefreshCw, Users, Zap } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import type { SortingState } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  getCurrentWorkspace,
  resolveLang,
} from "@/features/layout/layout-context"
import { fetchCurrentCycle } from "@/features/workspace/billing/billing-api"
import { HOSTING_MODE_SAAS } from "@/features/workspace/billing/billing-utils"
import { WorkspaceLayout } from "@/features/workspace/components/workspace-layout"
import {
  fetchWorkspaceDetails,
  type WorkspaceDetails,
} from "@/features/workspace/workspace-api"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import { DailyTrendCard } from "./components/daily-trend-card"
import { EnvironmentUsageTable } from "./components/environment-usage-table"
import { PeriodSelector } from "./components/period-selector"
import { SummaryCard } from "./components/summary-card"
import { fetchWorkspaceUsage } from "./usage-api"
import type { MetricKey, PeriodKey, PeriodOption } from "./usage-types"
import {
  buildTrendData,
  buildUsageFilter,
  getCurrentCycleDates,
  getVsLabel,
  isMonthlyCycle,
} from "./usage-utils"

export function UsagePage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const isSaas = getRuntimeEnv().hostingMode === HOSTING_MODE_SAAS
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(() =>
    getCurrentWorkspace()
  )
  const [userSelectedPeriod, setUserSelectedPeriod] =
    useState<PeriodKey | null>(null)
  const [selectedMetric, setSelectedMetric] =
    useState<MetricKey>("flagEvaluations")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "flagEvaluations", desc: true },
  ])

  const cycleQuery = useQuery({
    queryKey: ["billing", "current-cycle"],
    queryFn: fetchCurrentCycle,
    enabled: isSaas,
    retry: 1,
  })
  const currentCycle = useMemo(
    () => getCurrentCycleDates(cycleQuery.data),
    [cycleQuery.data]
  )
  const showBillingPeriods = isSaas && isMonthlyCycle(currentCycle)
  const periodOptions = useMemo<PeriodOption[]>(
    () => [
      ...(showBillingPeriods
        ? [
            {
              label: t("workspace.usage.periods.currentBilling"),
              value: "currentBilling" as const,
            },
            {
              label: t("workspace.usage.periods.previousBilling"),
              value: "previousBilling" as const,
            },
          ]
        : []),
      {
        label: t("workspace.usage.periods.thisMonth"),
        value: "thisMonth",
      },
      { label: t("workspace.usage.periods.last7d"), value: "last7d" },
      { label: t("workspace.usage.periods.last30d"), value: "last30d" },
    ],
    [showBillingPeriods, t]
  )
  const defaultPeriod: PeriodKey = showBillingPeriods
    ? "currentBilling"
    : "thisMonth"
  const selectedPeriod =
    userSelectedPeriod &&
    periodOptions.some((period) => period.value === userSelectedPeriod)
      ? userSelectedPeriod
      : defaultPeriod

  useEffect(() => {
    let cancelled = false
    fetchWorkspaceDetails()
      .then((loadedWorkspace) => {
        if (!cancelled) {
          setWorkspace((current) => ({
            ...loadedWorkspace,
            license: loadedWorkspace.license ?? current?.license,
          }))
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  const usageFilter = useMemo(
    () => buildUsageFilter(selectedPeriod, currentCycle),
    [currentCycle, selectedPeriod]
  )
  const usageQuery = useQuery({
    queryKey: ["workspace", "usage", usageFilter],
    queryFn: () => fetchWorkspaceUsage(usageFilter),
    enabled: !isSaas || cycleQuery.isSuccess,
  })
  const usage = usageQuery.data
  const summary = usage?.summary
  const trendData = useMemo(
    () =>
      buildTrendData({
        dailyTrend: usage?.dailyTrend ?? [],
        filter: usageFilter,
        lang,
      }),
    [lang, usage?.dailyTrend, usageFilter]
  )
  const isInitialLoading =
    (isSaas && cycleQuery.isLoading) || usageQuery.isLoading
  const hasError = usageQuery.isError || (isSaas && cycleQuery.isError)

  function retry() {
    if (isSaas && cycleQuery.isError) {
      void cycleQuery.refetch()
    }
    void usageQuery.refetch()
  }

  return (
    <WorkspaceLayout workspace={workspace} lang={lang} activeTab="usage">
      <div className="space-y-4 pt-3 pb-8">
        <PeriodSelector
          isLoading={isSaas && cycleQuery.isLoading}
          lang={lang}
          options={periodOptions}
          selectedPeriod={selectedPeriod}
          usageFilter={usageFilter}
          onPeriodChange={setUserSelectedPeriod}
        />

        {hasError ? (
          <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{t("workspace.usage.failedToLoad")}</span>
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="size-3.5" />
              {t("workspace.usage.retry")}
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryCard
            icon={Users}
            label={t("workspace.usage.uniqueUsers")}
            value={summary?.uniqueUsers ?? 0}
            previous={summary?.prevUniqueUsers ?? 0}
            loading={isInitialLoading}
            vsLabel={getVsLabel(selectedPeriod, t)}
            accent="green"
            lang={lang}
          />
          <SummaryCard
            icon={Zap}
            label={t("workspace.usage.flagEvaluations")}
            value={summary?.totalFlagEvaluations ?? 0}
            previous={summary?.prevFlagEvaluations ?? 0}
            loading={isInitialLoading}
            vsLabel={getVsLabel(selectedPeriod, t)}
            accent="blue"
            lang={lang}
          />
          <SummaryCard
            icon={BarChart3}
            label={t("workspace.usage.customMetrics")}
            value={summary?.totalCustomMetrics ?? 0}
            previous={summary?.prevCustomMetrics ?? 0}
            loading={isInitialLoading}
            vsLabel={getVsLabel(selectedPeriod, t)}
            accent="amber"
            lang={lang}
          />
        </div>

        <DailyTrendCard
          data={trendData}
          isLoading={isInitialLoading}
          lang={lang}
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
        />

        <EnvironmentUsageTable
          data={usage?.environmentUsages ?? []}
          isLoading={isInitialLoading}
          lang={lang}
          sorting={sorting}
          summary={summary}
          onSortingChange={setSorting}
        />
      </div>
    </WorkspaceLayout>
  )
}
