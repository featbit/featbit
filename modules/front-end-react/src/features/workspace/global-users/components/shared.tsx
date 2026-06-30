import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function TextCell({ value, muted }: { value: string; muted?: boolean }) {
  const text = value || "-";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("block max-w-[17rem] truncate", muted && "text-muted-foreground")}>{text}</span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

export function SearchBox({
  value,
  placeholder,
  className,
  onChange
}: {
  value: string;
  placeholder: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cn("flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3", className)}>
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={value}
        placeholder={placeholder}
        onKeyDown={(event) => event.stopPropagation()}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function ActionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center rounded-sm bg-transparent p-0 text-sm font-medium text-foreground transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:text-blue-400"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-border last:border-b-0">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="px-5 py-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function StatusMessage({
  title,
  body,
  action
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {body ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DrawerHeader({ title, subtitle, onClose }: { title: string; subtitle?: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-border px-6 py-5">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
        {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
      </div>
      <Button variant="ghost" size="icon" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SimpleTable({ columns, rows, loading }: { columns: string[]; rows: ReactNode[][]; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-muted/40 text-left text-foreground">
          <tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-medium">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading ? (
            <TableSkeleton columns={columns.length} />
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length}><StatusMessage title={t("workspace.globalUsers.emptySearch")} /></td></tr>
          ) : rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="truncate px-4 py-3 align-middle">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
