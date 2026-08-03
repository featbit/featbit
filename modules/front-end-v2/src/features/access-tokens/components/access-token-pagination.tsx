import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const pageSizes = [10, 20, 30]

export function AccessTokenPagination({
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
  const from = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const to = Math.min(totalCount, pageIndex * pageSize)

  return (
    <div className="flex items-center justify-between gap-4 py-4 text-sm text-muted-foreground">
      <p>{t("accessTokens.showing", { from, to, total: totalCount })}</p>
      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger className="min-w-32">
            <SelectValue>
              {t("accessTokens.perPage", { count: pageSize })}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {t("accessTokens.perPage", { count: size })}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("accessTokens.previousPage")}
          disabled={pageIndex <= 1}
          onClick={() => onPageIndexChange(pageIndex - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("accessTokens.nextPage")}
          disabled={pageIndex >= totalPages}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
