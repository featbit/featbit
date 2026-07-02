import { FileText, Info } from "lucide-react";
import { useMemo } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<BillingInvoice>[]>(() => [
    {
      accessorKey: "billingDate",
      header: t("workspace.billing.invoices.billingDate"),
      cell: ({ row }) => formatDate(row.original.billingDate ?? row.original.createdAt)
    },
    {
      accessorKey: "plan",
      header: t("workspace.billing.invoices.plan"),
      cell: ({ row }) => planMeta[normalizePlan(row.original.plan)].name
    },
    {
      accessorKey: "status",
      header: t("workspace.billing.invoices.status"),
      cell: ({ row }) => <InvoiceStatus status={row.original.status} />
    },
    {
      accessorKey: "amountPaid",
      header: t("workspace.billing.invoices.amount"),
      cell: ({ row }) => {
        const cents = row.original.amountPaid ?? row.original.amountDue ?? 0;
        return <span className="font-medium">{formatCurrency(cents / 100, row.original.currency ?? "USD")}</span>;
      }
    }
  ], [t]);
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
          <h2 className="text-lg font-semibold">{t("workspace.billing.invoices.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("workspace.billing.invoices.description")}</p>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          <Info className="h-3.5 w-3.5" />
          {t("workspace.billing.invoices.questions")}
          <a className="text-blue-600 hover:underline" href="mailto:support@featbit.co">{t("workspace.billing.actions.contactSupport")}</a>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-9" />)}
        </div>
      ) : isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {t("workspace.billing.errors.invoicesLoad")}
          <Button className="ml-3" variant="outline" size="sm" onClick={onRetry}>{t("workspace.billing.actions.retry")}</Button>
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex min-h-60 flex-col items-center justify-center rounded-md border border-dashed text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{t("workspace.billing.invoices.empty")}</p>
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
  const { t } = useTranslation();
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "paid") {
    return <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{t("workspace.billing.invoices.paid")}</Badge>;
  }
  if (normalized === "pending") {
    return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{t("workspace.billing.invoices.pending")}</Badge>;
  }
  if (normalized === "overdue") {
    return <Badge variant="destructive">{t("workspace.billing.invoices.overdue")}</Badge>;
  }
  return <Badge variant="secondary">{status || t("workspace.billing.invoices.unknown")}</Badge>;
}
