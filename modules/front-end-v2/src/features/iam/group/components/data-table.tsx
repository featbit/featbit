import type { ReactNode } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
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

export function GroupDataTable<TData>({
  data,
  columns,
  loading,
  emptyMessage,
  emptyAction,
  minWidth = 840,
}: {
  data: TData[]
  columns: ColumnDef<TData>[]
  loading: boolean
  emptyMessage: string
  emptyAction?: { label: string; onClick: () => void }
  minWidth?: number
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <Table className="table-fixed" style={{ minWidth }}>
        <TableHeader className="border-b text-left text-foreground">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="px-5 py-4 font-semibold"
                  style={{ width: header.getSize() }}
                >
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
          {loading ? (
            <TableSkeleton columns={columns.length} />
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="px-5 py-4 align-middle text-sm text-foreground"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <EmptyState message={emptyMessage} action={emptyAction} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex} className="px-5 py-5">
              <Skeleton className="h-4 w-3/4" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function EmptyState({
  message,
  action,
}: {
  message: ReactNode
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{message}</p>
      {action ? (
        <Button type="button" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
