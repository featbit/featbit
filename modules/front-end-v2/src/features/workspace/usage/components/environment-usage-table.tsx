import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  Card,
  CardContent,
  CardDescription,
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
  summary,
}: {
  data: EnvironmentUsage[]
  isLoading: boolean
  lang: "en" | "zh"
  summary?: UsageSummary
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
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("workspace.usage.perEnvironment")}</CardTitle>
        <CardDescription>
          {t("workspace.usage.perEnvironmentSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border bg-background">
          <Table className="min-w-[900px] table-fixed">
            <TableHeader className="border-b text-left text-foreground">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="px-5 py-4 font-semibold">
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
                        className="px-5 py-4 align-middle text-sm text-foreground"
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
    header: label,
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
        <TableRow key={rowIndex} className="last:border-b-0">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex} className="px-5 py-4">
              <Skeleton className="h-4 w-3/4" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
