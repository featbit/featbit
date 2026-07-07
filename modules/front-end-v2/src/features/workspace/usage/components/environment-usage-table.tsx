import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useMemo, type Dispatch, type SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { EmptyState } from "./empty-state"
import type { EnvironmentUsage, UsageSummary } from "../usage-types"
import { getUsagePercent, integerNumber } from "../usage-utils"

export function EnvironmentUsageTable({
  data,
  isLoading,
  lang,
  sorting,
  summary,
  onSortingChange,
}: {
  data: EnvironmentUsage[]
  isLoading: boolean
  lang: "en" | "zh"
  sorting: SortingState
  summary?: UsageSummary
  onSortingChange: Dispatch<SetStateAction<SortingState>>
}) {
  const { t } = useTranslation()
  const columns = useMemo<ColumnDef<EnvironmentUsage>[]>(
    () => [
      {
        accessorKey: "envName",
        header: t("workspace.usage.environment"),
        cell: ({ row }) => (
          <div className="min-w-48">
            <div className="font-medium text-foreground">
              {row.original.envName}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {row.original.orgName} / {row.original.projectName}
            </div>
          </div>
        ),
      },
      metricColumn({
        key: "uniqueUsers",
        label: t("workspace.usage.uniqueUsers"),
        total: summary?.uniqueUsers ?? 0,
        colorClass: "bg-green-600",
        lang,
      }),
      metricColumn({
        key: "flagEvaluations",
        label: t("workspace.usage.flagEvaluations"),
        total: summary?.totalFlagEvaluations ?? 0,
        colorClass: "bg-blue-600",
        lang,
      }),
      metricColumn({
        key: "customMetrics",
        label: t("workspace.usage.customMetrics"),
        total: summary?.totalCustomMetrics ?? 0,
        colorClass: "bg-amber-500",
        lang,
      }),
    ],
    [lang, summary, t]
  )
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("workspace.usage.perEnvironment")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("workspace.usage.perEnvironmentSubtitle")}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border">
          <Table className="min-w-[900px] table-fixed">
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="px-4 py-3">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <UsageTableSkeleton columns={columns.length} />
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      title={t("workspace.usage.emptyEnvironments")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="px-4 py-3 align-middle"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function metricColumn({
  key,
  label,
  total,
  colorClass,
  lang,
}: {
  key: "uniqueUsers" | "flagEvaluations" | "customMetrics"
  label: string
  total: number
  colorClass: string
  lang: "en" | "zh"
}): ColumnDef<EnvironmentUsage> {
  return {
    accessorKey: key,
    header: ({ column }) => {
      const sorted = column.getIsSorted()

      return (
        <Button
          type="button"
          variant="ghost"
          className="h-auto px-0 py-0 font-medium text-foreground hover:bg-transparent"
          onClick={() => column.toggleSorting(sorted === "asc")}
        >
          {label}
          {sorted === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : sorted === "desc" ? (
            <ArrowDown className="size-3.5" />
          ) : (
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => {
      const value = row.original[key]
      const percent = getUsagePercent(value, total)

      return (
        <div className="w-full min-w-44">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-foreground">
              {integerNumber(value, lang)}
            </span>
            <span className="text-xs text-muted-foreground">({percent}%)</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", colorClass)}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        </div>
      )
    },
  }
}

function UsageTableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex} className="px-4 py-3">
              <Skeleton className="h-5 w-3/4" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
