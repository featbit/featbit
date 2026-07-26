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
import type { Lang } from "@/features/layout/layout-types"

export function FlagsPagination({
  pageIndex,
  pageSize,
  totalCount,
  disabled,
  onPageIndexChange,
  onPageSizeChange,
}: {
  lang: Lang
  pageIndex: number
  pageSize: number
  totalCount: number
  disabled: boolean
  onPageIndexChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const { t } = useTranslation()
  if (!totalCount) return null
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = (pageIndex - 1) * pageSize + 1
  const to = Math.min(pageIndex * pageSize, totalCount)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>{t("featureFlags.showing", { from, to, total: totalCount })}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || pageIndex <= 1}
          aria-label={t("featureFlags.previous")}
          onClick={() => onPageIndexChange(pageIndex - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          {pageIndex}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || pageIndex >= pageCount}
          aria-label={t("featureFlags.next")}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          <ChevronRight />
        </Button>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
          disabled={disabled}
        >
          <SelectTrigger className="w-32">
            <SelectValue>
              {t("featureFlags.perPage", { count: pageSize })}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {[10, 20, 30].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {t("featureFlags.perPage", { count: size })}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
