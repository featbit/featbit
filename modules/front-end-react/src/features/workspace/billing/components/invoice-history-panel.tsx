import { FileText, Info } from "lucide-react";
import { useMemo } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BillingInvoice } from "../billing-api";
import { formatCurrency, formatDate, normalizePlan, planMeta } from "../billing-utils";

export function InvoiceHistoryPanel({
  invoices,
  isLoading,
  isError,
  onRetry
}: {
  invoices: BillingInvoice[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const columns = useMemo<ColumnDef<BillingInvoice>[]>(() => [
    {
      accessorKey: "billingDate",
      header: "Billing date",
      cell: ({ row }) => formatDate(row.original.billingDate ?? row.original.createdAt)
    },
    {
      accessorKey: "plan",
      header: "Plan",
      cell: ({ row }) => planMeta[normalizePlan(row.original.plan)].name
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <InvoiceStatus status={row.original.status} />
    },
    {
      accessorKey: "amountPaid",
      header: "Amount",
      cell: ({ row }) => {
        const cents = row.original.amountPaid ?? row.original.amountDue ?? 0;
        return <span className="font-medium">{formatCurrency(cents / 100, row.original.currency ?? "USD")}</span>;
      }
    }
  ], []);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 5 } }
  });

  return (
    <Card className="rounded-md p-5 shadow-none">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Invoice history</h2>
          <p className="mt-1 text-sm text-muted-foreground">Recent invoices for this workspace.</p>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          <Info className="h-3.5 w-3.5" />
          Questions about billing?
          <a className="text-blue-600 hover:underline" href="mailto:support@featbit.co">Contact support</a>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-9" />)}
        </div>
      ) : isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load invoices.
          <Button className="ml-3" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex min-h-60 flex-col items-center justify-center rounded-md border border-dashed text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No invoices yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="font-semibold">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function InvoiceStatus({ status }: { status?: string }) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "paid") {
    return <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Paid</Badge>;
  }
  if (normalized === "pending") {
    return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Pending</Badge>;
  }
  if (normalized === "overdue") {
    return <Badge variant="destructive">Overdue</Badge>;
  }
  return <Badge variant="secondary">{status || "Unknown"}</Badge>;
}
