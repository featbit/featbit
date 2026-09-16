import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, ChevronLeft, ChevronRight, CircleX } from "lucide-react"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ReleaseHealthAuditLog } from "./audit-log-samples"

export function AuditResult({
  result,
}: {
  result: ReleaseHealthAuditLog["result"]
}) {
  const { t } = useTranslation()
  const Icon = result === "succeeded" ? CheckCircle2 : CircleX
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${result === "succeeded" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}
    >
      <Icon className="size-3.5" />
      {t(`releaseHealth.audit.${result}`)}
    </span>
  )
}

export function AuditLogTable({
  data,
  environment,
  pageIndex,
  onPageChange,
  onSelect,
}: {
  data: ReleaseHealthAuditLog[]
  environment: string
  pageIndex: number
  onPageChange: (page: number) => void
  onSelect: (record: ReleaseHealthAuditLog) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === "zh" ? "zh-CN" : "en-US"
  const columns = useMemo<ColumnDef<ReleaseHealthAuditLog>[]>(
    () => [
      {
        id: "time",
        header: t("releaseHealth.audit.time"),
        cell: ({ row }) => {
          const date = new Date(row.original.occurredAt)
          return (
            <time
              dateTime={row.original.occurredAt}
              className="whitespace-nowrap tabular-nums"
            >
              <span className="block">
                {date.toLocaleDateString(locale, { dateStyle: "medium" })}
              </span>
              <span className="text-xs text-muted-foreground">
                {date.toLocaleTimeString(locale, { hour12: false })}
              </span>
            </time>
          )
        },
      },
      {
        id: "object",
        header: t("releaseHealth.audit.object"),
        cell: ({ row }) => (
          <div className="max-w-64">
            <button
              type="button"
              className="text-left font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => onSelect(row.original)}
              aria-label={t("releaseHealth.audit.viewDetails", {
                id: row.original.id,
              })}
            >
              {row.original.object.name}
            </button>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(`releaseHealth.audit.modules.${row.original.module}`)}
            </p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={row.original.object.key}
            >
              {row.original.object.key}
            </p>
          </div>
        ),
      },
      {
        id: "operation",
        header: t("releaseHealth.audit.operation"),
        cell: ({ row }) =>
          t(`releaseHealth.audit.actions.${row.original.action}`),
      },
      {
        id: "actor",
        header: t("releaseHealth.audit.actor"),
        cell: ({ row }) => (
          <div>
            <p>{row.original.actor.name}</p>
            <p className="text-xs text-muted-foreground">
              {t(`releaseHealth.audit.${row.original.actor.kind}`)}
            </p>
          </div>
        ),
      },
      {
        id: "source",
        header: t("releaseHealth.audit.source"),
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.source}</Badge>
        ),
      },
      {
        id: "scope",
        header: t("releaseHealth.audit.scope"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.scope === "project"
              ? t("releaseHealth.audit.project")
              : environment}
          </span>
        ),
      },
      {
        id: "result",
        header: t("releaseHealth.audit.result"),
        cell: ({ row }) => <AuditResult result={row.original.result} />,
      },
    ],
    [t, locale, environment, onSelect]
  )
  // TanStack Table manages its row and pagination models.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    state: { pagination: { pageIndex, pageSize: 10 } },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table
        className="min-w-[980px]"
        aria-label={t("releaseHealth.audit.title")}
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {table.getHeaderGroups()[0].headers.map((header) => (
              <TableHead key={header.id} className="px-4">
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="px-4 py-3 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {!data.length && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center text-muted-foreground"
              >
                {t("releaseHealth.audit.empty")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {t("releaseHealth.audit.pagination", {
            start: data.length ? pageIndex * 10 + 1 : 0,
            end: Math.min((pageIndex + 1) * 10, data.length),
            total: data.length,
          })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => onPageChange(pageIndex - 1)}
            aria-label={t("releaseHealth.audit.previous")}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!table.getCanNextPage()}
            onClick={() => onPageChange(pageIndex + 1)}
            aria-label={t("releaseHealth.audit.next")}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
