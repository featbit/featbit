import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function paginationPages(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const visible = new Set([1, total])
  for (
    let page = Math.max(1, current - 2);
    page <= Math.min(total, current + 2);
    page++
  )
    visible.add(page)
  const pages = [...visible].sort((a, b) => a - b)
  return pages.flatMap<number | string>((page, index) => {
    const previous = pages[index - 1]
    if (!previous || page === previous + 1) return [page]
    if (page === previous + 2) return [previous + 1, page]
    return [`gap-${previous}`, page]
  })
}

export function ListPaginationControls({
  pageIndex,
  pageSize,
  totalCount,
  disabled = false,
  onPageIndexChange,
  onPageSizeChange,
  perPage,
  previousLabel,
  nextLabel,
  pageSizeOptions = [10, 20, 30],
}: {
  pageIndex: number
  pageSize: number
  totalCount: number
  disabled?: boolean
  onPageIndexChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  perPage: (count: number) => string
  previousLabel?: string
  nextLabel?: string
  pageSizeOptions?: number[]
}) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  return (
    <div className="flex items-center gap-4 text-foreground">
      <Pagination className="mx-0 w-auto" aria-label={t("pagination.label")}>
        <PaginationContent>
          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || pageIndex <= 1}
              aria-label={previousLabel ?? t("pagination.previousPage")}
              onClick={() => onPageIndexChange(pageIndex - 1)}
            >
              <ChevronLeft />
              {t("pagination.previous")}
            </Button>
          </PaginationItem>
          {paginationPages(pageIndex, totalPages).map((page) => (
            <PaginationItem key={page}>
              {typeof page === "number" ? (
                <Button
                  type="button"
                  size="icon"
                  variant={page === pageIndex ? "outline" : "ghost"}
                  aria-current={page === pageIndex ? "page" : undefined}
                  disabled={disabled}
                  onClick={() => page !== pageIndex && onPageIndexChange(page)}
                >
                  {page}
                </Button>
              ) : (
                <PaginationEllipsis />
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || pageIndex >= totalPages}
              aria-label={nextLabel ?? t("pagination.nextPage")}
              onClick={() => onPageIndexChange(pageIndex + 1)}
            >
              {t("pagination.next")}
              <ChevronRight />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <Select
        value={String(pageSize)}
        disabled={disabled}
        onValueChange={(value) => {
          if (value) onPageSizeChange(Number(value))
        }}
      >
        <SelectTrigger className="w-32" aria-label={t("pagination.pageSize")}>
          <SelectValue>{perPage(pageSize)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {perPage(size)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
