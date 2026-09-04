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

export function ExperimentsPagination({
  pageIndex,
  pageSize,
  totalCount,
  disabled,
  onPageIndexChange,
  onPageSizeChange,
}: {
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
  const adjacentPage = pageIndex < pageCount ? pageIndex + 1 : null

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>
        {t("releaseDecision.experiments.showing", {
          from,
          to,
          total: totalCount,
        })}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || pageIndex <= 1}
          aria-label={t("releaseDecision.experiments.previous")}
          onClick={() => onPageIndexChange(pageIndex - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground tabular-nums">
          {pageIndex}
        </span>
        {adjacentPage ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled}
            className="tabular-nums"
            onClick={() => onPageIndexChange(adjacentPage)}
          >
            {adjacentPage}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || pageIndex >= pageCount}
          aria-label={t("releaseDecision.experiments.next")}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          <ChevronRight />
        </Button>
        <Select
          value={String(pageSize)}
          disabled={disabled}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger className="w-32">
            <SelectValue>
              {t("releaseDecision.experiments.perPage", { count: pageSize })}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {[10, 20, 30].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {t("releaseDecision.experiments.perPage", { count: size })}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
