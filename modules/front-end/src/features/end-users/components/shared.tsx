import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function SearchInput({
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
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        placeholder={placeholder}
        className="pl-9"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function TruncatedValue({
  value,
  mono = false,
  muted = false,
}: {
  value: string
  mono?: boolean
  muted?: boolean
}) {
  const displayValue = value || "—"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "block max-w-full truncate",
              mono && "font-mono text-xs",
              (muted || !value) && "text-muted-foreground"
            )}
          />
        }
      >
        {displayValue}
      </TooltipTrigger>
      {value ? <TooltipContent>{value}</TooltipContent> : null}
    </Tooltip>
  )
}

export function TableSkeleton({
  columns,
  rows = 8,
}: {
  columns: number
  rows?: number
}) {
  return Array.from({ length: rows }).map((_, rowIndex) => (
    <TableRow key={rowIndex}>
      {Array.from({ length: columns }).map((__, columnIndex) => (
        <TableCell key={columnIndex} className="px-5 py-4">
          <Skeleton className="h-4 w-full max-w-32" />
        </TableCell>
      ))}
    </TableRow>
  ))
}

export function TableMessage({
  columns,
  title,
  action,
}: {
  columns: number
  title: string
  action?: ReactNode
}) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="h-64 text-center">
        <p className="font-medium text-foreground">{title}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </TableCell>
    </TableRow>
  )
}

export function CursorPagination({
  pageSize,
  hasPrevious,
  hasNext,
  disabled,
  previousLabel,
  nextLabel,
  perPageLabel,
  onPrevious,
  onNext,
  onPageSizeChange,
}: {
  pageSize: number
  hasPrevious: boolean
  hasNext: boolean
  disabled: boolean
  previousLabel: string
  nextLabel: string
  perPageLabel: (size: number) => string
  onPrevious: () => void
  onNext: () => void
  onPageSizeChange: (size: number) => void
}) {
  return (
    <div className="flex justify-end gap-2 pt-4">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !hasPrevious}
        onClick={onPrevious}
      >
        <ChevronLeft className="size-4" />
        {previousLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !hasNext}
        onClick={onNext}
      >
        {nextLabel}
        <ChevronRight className="size-4" />
      </Button>
      <Select
        value={String(pageSize)}
        onValueChange={(value) => value && onPageSizeChange(Number(value))}
        disabled={disabled}
      >
        <SelectTrigger className="min-w-28">
          <SelectValue>{perPageLabel(pageSize)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {[10, 20, 30].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {perPageLabel(size)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export function NumberedPagination({
  page,
  pageSize,
  total,
  summary,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  summary?: (from: number, to: number, total: number) => string
  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount]))
    .filter((item) => item >= 1 && item <= pageCount)
    .sort((a, b) => a - b)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 py-4 text-sm text-muted-foreground",
        summary ? "justify-between" : "justify-end"
      )}
    >
      {summary ? <span>{summary(from, to, total)}</span> : null}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        {pages.map((item, index) => (
          <span key={item} className="flex items-center gap-2">
            {index > 0 && item - pages[index - 1] > 1 ? <span>…</span> : null}
            <Button
              type="button"
              size="icon-sm"
              variant={item === page ? "outline" : "ghost"}
              className={cn(item === page && "border-primary text-primary")}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          </span>
        ))}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
