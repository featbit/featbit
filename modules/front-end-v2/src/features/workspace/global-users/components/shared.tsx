import { Search } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function TextCell({
  value,
  muted,
}: {
  value: string
  muted?: boolean
}) {
  const text = value || "-"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "block max-w-[17rem] truncate",
              muted && "text-muted-foreground"
            )}
          >
            {text}
          </span>
        }
      />
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

export function SearchBox({
  value,
  placeholder,
  className,
  onChange,
}: {
  value: string
  placeholder: string
  className?: string
  onChange: (value: string) => void
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="bg-background pl-9 text-sm"
        value={value}
        placeholder={placeholder}
        onKeyDown={(event) => event.stopPropagation()}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function ActionLink({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto p-0 text-sm font-medium text-foreground"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b last:border-b-0">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="px-5 py-4">
              <Skeleton className="h-4 w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function StatusMessage({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {body ? (
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function SimpleTable({
  columns,
  rows,
  loading,
}: {
  columns: string[]
  rows: ReactNode[][]
  loading: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full table-fixed">
        <thead className="bg-muted/40 text-left text-foreground">
          <tr className="border-b">
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-sm font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableSkeleton columns={columns.length} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <StatusMessage title={t("workspace.globalUsers.emptySearch")} />
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="truncate px-4 py-3 align-middle text-sm"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
