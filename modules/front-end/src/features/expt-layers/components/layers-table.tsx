import { Copy, Info, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
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
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import type {
  Layer,
  LayerAllocationSummary,
  LayerRunSummary,
} from "../layers-types"
import { runColor, runStateColor } from "../layers-utils"

type Props = {
  items: Layer[]
  loading: boolean
  archived: boolean
  query: string
  lang: Lang
  mutatingId: string | null
  onCopy: (key: string) => void
  onEdit: (layer: Layer) => void
  onArchive: (layer: Layer) => void
  onRestore: (layer: Layer) => void
  onClearSearch: () => void
  onCreate: () => void
}

function TrafficAllocation({
  runs,
  summary,
}: {
  runs: LayerRunSummary[]
  summary?: LayerAllocationSummary
}) {
  const { t } = useTranslation()
  const allocationRuns = runs
    .map((run, colorIndex) => ({ run, colorIndex }))
    .filter(({ run }) => run.includedInAllocation)

  return (
    <div className="min-w-72 space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
      <div className="relative flex h-10 overflow-hidden rounded-md border bg-muted/50">
        {!summary ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t("releaseDecision.layers.allocationUnavailable")}
          </div>
        ) : allocationRuns.length ? (
          allocationRuns.map(({ run, colorIndex }) => {
            const width = Math.max(0, run.end - run.start)
            return (
              <Tooltip key={run.id}>
                <TooltipTrigger
                  render={
                    <div
                      aria-label={`${run.experimentName}, ${run.key}, ${run.start}–${run.end}%`}
                      className={`absolute inset-y-0 cursor-default overflow-hidden border-r border-background/70 text-xs text-foreground ${runColor(colorIndex)}`}
                      style={{ left: `${run.start}%`, width: `${width}%` }}
                    />
                  }
                >
                  {width >= 18 ? (
                    <span className="block px-2 py-1 leading-4">
                      <span className="block truncate font-medium">
                        {run.experimentName}
                      </span>
                      <span className="block truncate tabular-nums">
                        {run.key} · {run.start}–{run.end}%
                      </span>
                    </span>
                  ) : width >= 8 ? (
                    <span className="flex h-full min-w-0 items-center px-1.5 font-medium">
                      <span className="truncate">{run.experimentName}</span>
                    </span>
                  ) : null}
                </TooltipTrigger>
                <TooltipContent className="block space-y-0.5">
                  <div className="font-medium">{run.experimentName}</div>
                  <div className="flex items-center gap-1.5 text-background/80">
                    <code>{run.key}</code>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                      {run.start}–{run.end}%
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t("releaseDecision.layers.noAllocation")}
          </div>
        )}
        {summary?.overlaps.map((overlap) => (
          <div
            key={`${overlap.start}-${overlap.end}`}
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{
              left: `${overlap.start}%`,
              width: `${overlap.end - overlap.start}%`,
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--color-amber-500) 0, var(--color-amber-500) 3px, transparent 3px, transparent 6px)",
            }}
          />
        ))}
      </div>
      {summary ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span>
            {t("releaseDecision.layers.allocationSummary", {
              reserved: summary.reservedPercent,
              free: summary.freePercent,
            })}
          </span>
          {summary.overlaps.map((overlap) => (
            <span
              key={`${overlap.start}-${overlap.end}`}
              className="text-amber-600 dark:text-amber-400"
            >
              {t("releaseDecision.layers.overlapRange", overlap)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AllocationStatus({ summary }: { summary?: LayerAllocationSummary }) {
  const { t } = useTranslation()
  if (!summary) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("releaseDecision.layers.allocationUnavailable")}
      </span>
    )
  }
  if (summary.status === "mixed-assignment-units") {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
        <TriangleAlert className="size-4 shrink-0" />
        {t("releaseDecision.layers.mixedAssignmentUnits")}
      </div>
    )
  }
  if (summary.status === "over-allocated") {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
        <TriangleAlert className="size-4 shrink-0" />
        {t("releaseDecision.layers.overAllocated")}
      </div>
    )
  }
  if (summary.status === "overlap") {
    const overlap = summary.overlaps.reduce(
      (sum, item) => sum + item.end - item.start,
      0
    )
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
        <TriangleAlert className="size-4 shrink-0" />
        {t("releaseDecision.layers.overlap", { count: overlap })}
      </div>
    )
  }
  if (summary.status !== "no-conflicts") {
    return (
      <span className="text-sm text-muted-foreground">
        {t("releaseDecision.layers.allocationUnavailable")}
      </span>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="size-2.5 rounded-full bg-emerald-600" />
      {t("releaseDecision.layers.noConflicts")}
    </div>
  )
}

function ExperimentRuns({
  runs,
  lang,
}: {
  runs: LayerRunSummary[]
  lang: Lang
}) {
  const { t } = useTranslation()
  if (!runs.length) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("releaseDecision.layers.noExperimentRuns")}
      </span>
    )
  }

  return (
    <div className="min-w-64 divide-y">
      {runs.map((run, index) => (
        <div key={run.id} className="space-y-1.5 py-2 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`size-3 shrink-0 rounded-sm ${runColor(index)}`} />
            <Link
              to={localizedPath(lang, "/experiments")}
              className="truncate text-sm font-semibold text-foreground hover:underline"
            >
              {run.experimentName}
            </Link>
            <code className="ml-auto max-w-32 truncate rounded border bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground">
              {run.key}
            </code>
          </div>
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {run.start}–{run.end}%
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${runStateColor(run.status)}`}
              />
              {t(
                `releaseDecision.layers.runStatus.${run.status.toLowerCase()}`,
                {
                  defaultValue: run.status,
                }
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function LayersTable({
  items,
  loading,
  archived,
  query,
  lang,
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
    <Table className="min-w-[1280px] table-fixed">
      <TableHeader className="border-b text-left text-foreground">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[20%] px-5 py-4 font-semibold">
            {t("releaseDecision.layers.columns.layer")}
          </TableHead>
          <TableHead className="w-[10%] px-5 py-4 font-semibold">
            <span className="flex items-center gap-1.5">
              {t("releaseDecision.layers.columns.assignmentUnit")}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-sm text-muted-foreground"
                    />
                  }
                >
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-80">
                  {t("releaseDecision.layers.assignmentUnitTooltip")}
                </TooltipContent>
              </Tooltip>
            </span>
          </TableHead>
          <TableHead className="w-[27%] px-5 py-4 font-semibold">
            {t("releaseDecision.layers.columns.trafficAllocation")}
          </TableHead>
          <TableHead className="w-[13%] px-5 py-4 font-semibold">
            {t("releaseDecision.layers.columns.allocationStatus")}
          </TableHead>
          <TableHead className="w-[20%] px-5 py-4 font-semibold">
            {t("releaseDecision.layers.columns.experimentRuns")}
          </TableHead>
          <TableHead className="w-[10%] px-5 py-4 font-semibold">
            {t("releaseDecision.layers.columns.actions")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 4 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: 6 }).map((__, columnIndex) => (
                <TableCell key={columnIndex} className="px-5 py-3">
                  <Skeleton className="h-12 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="p-0">
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  {query
                    ? t("releaseDecision.layers.filteredEmpty")
                    : archived
                      ? t("releaseDecision.layers.archivedEmpty")
                      : t("releaseDecision.layers.empty")}
                </p>
                {!query ? (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      archived
                        ? "releaseDecision.layers.archivedEmptyHelper"
                        : "releaseDecision.layers.emptyHelper"
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
                    {t("releaseDecision.layers.clearSearch")}
                  </Button>
                ) : !archived ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={onCreate}
                  >
                    {t("releaseDecision.layers.new")}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ) : (
          items.map((layer) => {
            const runs = layer.experimentRuns ?? []
            const pending = mutatingId === layer.id
            return (
              <TableRow key={layer.id}>
                <TableCell className="px-5 py-3 align-middle">
                  <div className="min-w-0 space-y-2">
                    <p
                      className="truncate font-semibold text-foreground"
                      title={layer.name}
                    >
                      {layer.name}
                    </p>
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        className="flex max-w-full min-w-0 items-center gap-1.5 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label={t("releaseDecision.layers.copyKey", {
                          key: layer.key,
                        })}
                        title={layer.key}
                        onClick={() => onCopy(layer.key)}
                      >
                        <span className="truncate">{layer.key}</span>
                        <Copy className="size-3 shrink-0" />
                      </button>
                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1.5 font-normal"
                      >
                        <span
                          className={`size-2 rounded-full ${layer.status === "archived" ? "bg-zinc-400" : "bg-emerald-600"}`}
                        />
                        {t(`releaseDecision.layers.${layer.status}`)}
                      </Badge>
                    </div>
                    {layer.description ? (
                      <p
                        className="line-clamp-2 text-sm text-muted-foreground"
                        title={layer.description}
                      >
                        {layer.description}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="px-5 py-3 align-middle">
                  <code className="rounded border bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                    {layer.assignmentUnitSelector || "user.keyId"}
                  </code>
                </TableCell>
                <TableCell className="px-5 py-3 align-middle">
                  <TrafficAllocation
                    runs={runs}
                    summary={layer.allocationSummary}
                  />
                </TableCell>
                <TableCell className="px-5 py-3 align-middle">
                  <AllocationStatus summary={layer.allocationSummary} />
                </TableCell>
                <TableCell className="px-5 py-3 align-middle">
                  <ExperimentRuns runs={runs} lang={lang} />
                </TableCell>
                <TableCell className="px-5 py-3 align-middle">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 leading-none font-medium"
                      disabled={pending}
                      onClick={() => onEdit(layer)}
                    >
                      <span className="leading-none">
                        {t("releaseDecision.layers.edit")}
                      </span>
                    </Button>
                    {layer.status === "active" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 leading-none font-medium"
                        disabled={pending}
                        onClick={() => onArchive(layer)}
                      >
                        <span className="leading-none">
                          {t("releaseDecision.layers.archive")}
                        </span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 leading-none font-medium"
                        disabled={pending}
                        onClick={() => onRestore(layer)}
                      >
                        <span className="leading-none">
                          {t("releaseDecision.layers.restore")}
                        </span>
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
