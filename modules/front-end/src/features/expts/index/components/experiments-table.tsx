import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Lang } from "@/features/layout/layout-types"
import type { ExperimentListItem } from "../experiment-types"
import {
  experimentMethodKeys,
  experimentStageDot,
  formatExperimentDate,
} from "../experiments-utils"

type Props = {
  items: ExperimentListItem[]
  loading: boolean
  filtered: boolean
  lang: Lang
  detailsHref: (id: string) => string
  onFlagFilter: (key: string) => void
  onClearFilters: () => void
  onCreate: () => void
}

function RunsCell({ experiment }: { experiment: ExperimentListItem }) {
  const { t } = useTranslation()
  if (!experiment.runCount) {
    return (
      <span className="text-muted-foreground">
        {t("releaseDecision.experiments.noRuns")}
      </span>
    )
  }

  const methods = experimentMethodKeys(experiment.runMethodSummary)
  return (
    <div className="space-y-1">
      <p className="text-foreground">
        {t("releaseDecision.experiments.runCount", {
          count: experiment.runCount,
        })}
      </p>
      {methods.length ? (
        <p className="text-muted-foreground">
          {methods
            .map((method) => t(`releaseDecision.experiments.methods.${method}`))
            .join(" · ")}
        </p>
      ) : null}
    </div>
  )
}

export function ExperimentsTable({
  items,
  loading,
  filtered,
  lang,
  detailsHref,
  onFlagFilter,
  onClearFilters,
  onCreate,
}: Props) {
  const { t } = useTranslation()

  return (
    <Table className="min-w-[1120px] table-fixed">
      <TableHeader className="border-b text-left text-foreground">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[28%] px-5 py-4 font-semibold">
            {t("releaseDecision.experiments.columns.experiment")}
          </TableHead>
          <TableHead className="w-[17%] px-5 py-4 font-semibold">
            {t("releaseDecision.experiments.columns.featureFlag")}
          </TableHead>
          <TableHead className="w-[16%] px-5 py-4 font-semibold">
            {t("releaseDecision.experiments.columns.runs")}
          </TableHead>
          <TableHead className="w-[18%] px-5 py-4 font-semibold">
            {t("releaseDecision.experiments.columns.stage")}
          </TableHead>
          <TableHead className="w-[15%] px-5 py-4 font-semibold">
            {t("releaseDecision.experiments.columns.lastChange")}
          </TableHead>
          <TableHead className="w-[10%] px-5 py-4 font-semibold">
            {t("releaseDecision.experiments.columns.actions")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 5 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {["experiment", "flag", "runs", "stage", "date", "actions"].map(
                (column) => (
                  <TableCell key={column} className="px-5 py-4">
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                )
              )}
            </TableRow>
          ))
        ) : items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="p-0">
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t(
                    filtered
                      ? "releaseDecision.experiments.filteredEmpty"
                      : "releaseDecision.experiments.empty"
                  )}
                </p>
                {!filtered ? (
                  <p className="text-sm text-muted-foreground">
                    {t("releaseDecision.experiments.emptyHelper")}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={filtered ? onClearFilters : onCreate}
                >
                  {t(
                    filtered
                      ? "releaseDecision.experiments.clearFilters"
                      : "releaseDecision.experiments.new"
                  )}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          items.map((experiment) => {
            const href = detailsHref(experiment.id)
            return (
              <TableRow key={experiment.id}>
                <TableCell className="px-5 py-4">
                  <div className="min-w-0 space-y-1">
                    <Link
                      to={href}
                      className="block truncate font-semibold text-foreground underline-offset-4 hover:underline"
                      title={experiment.name}
                    >
                      {experiment.name}
                    </Link>
                    {experiment.description ? (
                      <p
                        className="truncate text-sm text-muted-foreground"
                        title={experiment.description}
                      >
                        {experiment.description}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="px-5 py-4">
                  {experiment.flagKey ? (
                    <button
                      type="button"
                      className="inline-block max-w-full truncate rounded bg-muted px-2 py-0.5 align-middle font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      title={experiment.flagKey}
                      onClick={() => onFlagFilter(experiment.flagKey!)}
                    >
                      {experiment.flagKey}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("releaseDecision.experiments.notBound")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-5 py-4">
                  <RunsCell experiment={experiment} />
                </TableCell>
                <TableCell className="px-5 py-4">
                  <Badge variant="outline" className="gap-1.5 font-normal">
                    <span
                      className={`size-2 rounded-full ${experimentStageDot(experiment.stage)}`}
                    />
                    {t(
                      `releaseDecision.experiments.stages.${experiment.stage}`
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="px-5 py-4 tabular-nums">
                  {formatExperimentDate(experiment.updatedAt, lang)}
                </TableCell>
                <TableCell className="px-5 py-4">
                  <Link
                    to={href}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "sm",
                      className: "font-medium",
                    })}
                  >
                    {t("releaseDecision.experiments.details")}
                  </Link>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
