import type { ReactNode } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DetailRow = { id: string; cells: ReactNode[] }

export function MetricDetailTable({
  headings,
  rows,
  empty,
  alignLast = false,
  wrap = false,
}: {
  headings: string[]
  rows: DetailRow[]
  empty?: ReactNode
  alignLast?: boolean
  wrap?: boolean
}) {
  const table = useReactTable<DetailRow>({
    data: rows,
    columns: headings.map((header, index) => ({
      id: String(index),
      header,
      accessorFn: (row: DetailRow) => row.cells[index],
      cell: (context) => context.getValue<ReactNode>(),
    })),
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <Table className={wrap ? "table-fixed" : undefined}>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header, index) => (
              <TableHead
                key={header.id}
                className={
                  index === 0
                    ? "pl-5"
                    : alignLast && index === headings.length - 1
                      ? "pr-5 text-right"
                      : undefined
                }
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
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell, index) => (
              <TableCell
                key={cell.id}
                className={`${index === 0 ? "pl-5" : ""}${alignLast && index === headings.length - 1 ? "pr-5 text-right" : ""}${wrap ? "align-top break-words whitespace-pre-wrap" : ""}`}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {!rows.length && (
          <TableRow>
            <TableCell
              colSpan={headings.length}
              className="h-24 text-center text-muted-foreground"
            >
              {empty}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
