import { ChevronDown, ChevronUp, Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
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
import type {
  Metric,
  MetricExperimentUsage,
  MetricRole,
  MetricRun,
} from "../metrics-types"
import { metricRunStateColor } from "../metrics-utils"

type Props = {
  items: Metric[]
  loading: boolean
  archived: boolean
  query: string
  mutatingId: string | null
  onCopy: (key: string) => void
  onEdit: (metric: Metric) => void
  onArchive: (metric: Metric) => void
  onRestore: (metric: Metric) => void
  onClearSearch: () => void
  onCreate: () => void
}

function RoleBadge({ role }: { role: MetricRole }) {
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

function RunLine({ run }: { run: MetricRun }) {
  const { t } = useTranslation()
  const normalizedStatus = run.status.toLowerCase()
  return (
    <div className="flex min-h-5 items-center gap-2 text-xs">
      <code className="max-w-36 min-w-0 truncate text-muted-foreground">
        {run.key}
      </code>
      <span
        className={`size-2 shrink-0 rounded-full ${metricRunStateColor(run.status)}`}
      />
      <span className="text-foreground">
        {t(`releaseDecision.metrics.runStatus.${normalizedStatus}`, {
          defaultValue: run.status,
        })}
      </span>
    </div>
  )
}

function UsageGroup({ usage }: { usage: MetricExperimentUsage }) {
  const roleGroups = new Map<MetricRole, MetricRun[]>()
  for (const run of usage.runs ?? []) {
    roleGroups.set(run.role, [...(roleGroups.get(run.role) ?? []), run])
  }
  if (!roleGroups.size) {
    return null
  }

  return (
    <div className="divide-y">
      {[...roleGroups.entries()].map(([role, runs]) => (
        <div key={role} className="space-y-1 py-2 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {usage.experimentName}
            </span>
            <RoleBadge role={role} />
          </div>
          {runs.map((run) => (
            <RunLine key={run.id} run={run} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ExperimentRuns({ usage }: { usage?: MetricExperimentUsage[] }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const usageWithRuns = usage?.filter((item) => item.runs?.length)
  if (!usageWithRuns?.length) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("releaseDecision.metrics.noExperimentRuns")}
      </span>
    )
  }

  const allRuns = usageWithRuns.flatMap((item) => item.runs ?? [])
  const runCount = allRuns.length
  const visibleRuns = new Set(expanded ? allRuns : allRuns.slice(0, 2))
  const visibleUsage = usageWithRuns.flatMap((item) => {
    const runs = (item.runs ?? []).filter((run) => visibleRuns.has(run))
    return runs.length ? [{ ...item, runs }] : []
  })

  return (
    <div className="min-w-64">
      <div className="divide-y">
        {visibleUsage.map((item) => (
          <div key={item.experimentId} className="py-2 first:pt-0 last:pb-0">
            <UsageGroup usage={item} />
          </div>
        ))}
      </div>
      {runCount > 2 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 justify-start gap-1.5 px-0 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          {t(
            expanded
              ? "releaseDecision.metrics.showLessRuns"
              : "releaseDecision.metrics.showMoreRuns"
          )}
        </Button>
      ) : null}
    </div>
  )
}

export function MetricsTable({
  items,
  loading,
  archived,
  query,
  mutatingId,
  onCopy,
  onEdit,
  onArchive,
  onRestore,
  onClearSearch,
  onCreate,
}: Props) {
  const { t } = useTranslation()

  return (
    <Table className="min-w-[1120px] table-fixed">
      <TableHeader className="border-b text-left text-foreground">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[34%] px-5 py-4 font-semibold">
            {t("releaseDecision.metrics.columns.metric")}
          </TableHead>
          <TableHead className="w-[22%] px-5 py-4 font-semibold">
            {t("releaseDecision.metrics.columns.typeAggregation")}
          </TableHead>
          <TableHead className="w-[31%] px-5 py-4 font-semibold">
            {t("releaseDecision.metrics.columns.experimentRuns")}
          </TableHead>
          <TableHead className="w-[13%] px-5 py-4 font-semibold">
            {t("releaseDecision.metrics.columns.actions")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {["metric", "type", "runs", "actions"].map((column) => (
                <TableCell key={column} className="px-5 py-3">
                  <Skeleton
                    className={
                      column === "runs" ? "h-16 w-full" : "h-12 w-full"
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="p-0">
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  {query
                    ? t("releaseDecision.metrics.filteredEmpty")
                    : archived
                      ? t("releaseDecision.metrics.archivedEmpty")
                      : t("releaseDecision.metrics.empty")}
                </p>
                {!query ? (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      archived
                        ? "releaseDecision.metrics.archivedEmptyHelper"
                        : "releaseDecision.metrics.emptyHelper"
                    )}
                  </p>
                ) : null}
                {query ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={onClearSearch}
                  >
                    {t("releaseDecision.metrics.clearSearch")}
                  </Button>
                ) : !archived ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={onCreate}
                  >
                    {t("releaseDecision.metrics.new")}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ) : (
          items.map((metric) => {
            const pending = mutatingId === metric.id
            const numeric = metric.metricType === "numeric"
            const aggregation = numeric ? metric.metricAgg : "once"
            return (
              <TableRow key={metric.id}>
                <TableCell className="px-5 py-3 align-middle">
                  <div className="min-w-0 space-y-2">
                    <p
                      className="truncate font-semibold text-foreground"
                      title={metric.name}
                    >
                      {metric.name}
                    </p>
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        className="flex max-w-full min-w-0 items-center gap-1.5 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label={t("releaseDecision.metrics.copyKey", {
                          key: metric.key,
                        })}
                        title={metric.key}
                        onClick={() => onCopy(metric.key)}
                      >
                        <span className="truncate">{metric.key}</span>
                        <Copy className="size-3 shrink-0" />
                      </button>
                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1.5 font-normal"
                      >
                        <span
                          className={`size-2 rounded-full ${metric.status === "archived" ? "bg-zinc-400" : "bg-emerald-600"}`}
                        />
                        {t(`releaseDecision.metrics.${metric.status}`)}
                      </Badge>
                    </div>
                    {metric.description ? (
                      <p
                        className="line-clamp-2 text-sm text-muted-foreground"
                        title={metric.description}
                      >
                        {metric.description}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="px-5 py-3 align-middle">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {t(
                        `releaseDecision.metrics.types.${numeric ? "numeric" : "binary"}`
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t(`releaseDecision.metrics.aggregations.${aggregation}`)}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-5 py-3 align-middle">
                  <ExperimentRuns usage={metric.experimentUsage} />
                </TableCell>
                <TableCell className="px-5 py-3 align-middle">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="font-medium"
                      disabled={pending}
                      onClick={() => onEdit(metric)}
                    >
                      {t("releaseDecision.metrics.edit")}
                    </Button>
                    {metric.status === "active" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="font-medium"
                        disabled={pending}
                        onClick={() => onArchive(metric)}
                      >
                        {t("releaseDecision.metrics.archive")}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="font-medium"
                        disabled={pending}
                        onClick={() => onRestore(metric)}
                      >
                        {t("releaseDecision.metrics.restore")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
