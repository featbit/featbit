import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, Code2, Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import type { ReleaseHealthWebhook } from "./preview-store"

export function ReleaseHealthWebhooksTable({
  items,
  onEdit,
  onPreview,
  onRemove,
}: {
  items: ReleaseHealthWebhook[]
  onEdit: (item: ReleaseHealthWebhook) => void
  onPreview: (item: ReleaseHealthWebhook) => void
  onRemove: (item: ReleaseHealthWebhook) => void
}) {
  const { t } = useTranslation()
  const columns: ColumnDef<ReleaseHealthWebhook>[] = [
    {
      accessorKey: "name",
      header: t("webhooks.columns.webhook"),
      cell: ({ row }) => (
        <div className="min-w-40">
          <button
            className="text-left font-medium hover:underline"
            onClick={() => onEdit(row.original)}
          >
            {row.original.name}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`webhooks.template.${row.original.payloadTemplateType}`)} · JSON
            Handlebars
          </p>
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: t("webhooks.columns.status"),
      cell: ({ row }) => (
        <Badge variant="outline">
          <span
            className={`size-1.5 rounded-full ${row.original.isActive ? "bg-emerald-500" : "bg-muted-foreground"}`}
          />
          {t(
            row.original.isActive
              ? "webhooks.status.active"
              : "webhooks.status.inactive"
          )}
        </Badge>
      ),
    },
    {
      accessorKey: "url",
      header: t("webhooks.columns.endpoint"),
      cell: ({ row }) => (
        <span
          className="block max-w-72 truncate font-mono text-xs"
          title={row.original.url}
        >
          {row.original.url}
        </span>
      ),
    },
    {
      id: "scopes",
      header: t("webhooks.columns.scopes"),
      cell: ({ row }) => (
        <div className="min-w-40 space-y-1">
          {row.original.scopeNames.slice(0, 2).map((name) => (
            <div key={name} className="max-w-64 truncate text-xs" title={name}>
              {name}
            </div>
          ))}
          {row.original.scopeNames.length > 2 && (
            <span
              title={row.original.scopeNames.slice(2).join("\n")}
              className="text-xs text-muted-foreground"
            >
              +{row.original.scopeNames.length - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "delivery",
      header: t("webhooks.releaseHealth.lastDelivery"),
      cell: () => (
        <span className="text-xs text-muted-foreground">
          {t("webhooks.releaseHealth.previewBadge")}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => (
        <span className="sr-only">{t("webhooks.columns.actions")}</span>
      ),
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onPreview(row.original)}
            aria-label={t("webhooks.releaseHealth.previewFor", {
              name: row.original.name,
            })}
          >
            <Code2 />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onEdit(row.original)}
            aria-label={t("webhooks.releaseHealth.editFor", {
              name: row.original.name,
            })}
          >
            <Pencil />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onRemove(row.original)}
            aria-label={t("webhooks.releaseHealth.removeFor", {
              name: row.original.name,
            })}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })
  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} className="px-4 py-3">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {t("webhooks.showing", {
            from: table.getState().pagination.pageIndex * 10 + 1,
            to: Math.min(
              (table.getState().pagination.pageIndex + 1) * 10,
              items.length
            ),
            total: items.length,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={t("webhooks.previous")}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft />
          </Button>
          <span>
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={t("webhooks.next")}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </>
  )
}
