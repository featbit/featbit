import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const pageSizeOptions = [10, 20, 30]

export function TeamPagination({
  pageIndex,
  pageSize,
  totalCount,
  onPageIndexChange,
  onPageSizeChange,
}: {
  pageIndex: number
  pageSize: number
  totalCount: number
  onPageIndexChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const first = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const last = Math.min(totalCount, pageIndex * pageSize)
  const pages = Array.from(
    new Set([1, pageIndex - 1, pageIndex, pageIndex + 1, totalPages])
  )
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div>
        {t("iam.team.pagination.summary", { first, last, total: totalCount })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={pageIndex <= 1}
          onClick={() => onPageIndexChange(pageIndex - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((page, index) => {
          const previous = pages[index - 1]
          return (
            <span key={page} className="flex items-center gap-2">
              {previous && page - previous > 1 ? (
                <span className="px-2 text-foreground">...</span>
              ) : null}
              <Button
                type="button"
                variant={page === pageIndex ? "outline" : "ghost"}
                size="icon"
                className={cn(
                  page === pageIndex && "border-primary text-primary"
                )}
                onClick={() => onPageIndexChange(page)}
              >
                {page}
              </Button>
            </span>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={pageIndex >= totalPages}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="ml-0 min-w-28 justify-between md:ml-4"
              >
                {t("iam.team.pagination.perPage", { count: pageSize })}
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {pageSizeOptions.map((option) => (
              <DropdownMenuItem
                key={option}
                className="cursor-pointer"
                onClick={() => onPageSizeChange(option)}
              >
                {t("iam.team.pagination.perPage", { count: option })}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
