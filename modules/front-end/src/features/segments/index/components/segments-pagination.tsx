import { ListPaginationControls } from "@/components/list-pagination-controls"
import { useTranslation } from "react-i18next"

export function SegmentsPagination({
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

  const from = (pageIndex - 1) * pageSize + 1
  const to = Math.min(pageIndex * pageSize, totalCount)

  return (
    <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>{t("segments.showing", { from, to, total: totalCount })}</span>
      <ListPaginationControls
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        disabled={disabled}
        onPageIndexChange={onPageIndexChange}
        onPageSizeChange={onPageSizeChange}
        perPage={(count) => t("segments.perPage", { count })}
        previousLabel={t("segments.previous")}
        nextLabel={t("segments.next")}
      />
    </div>
  )
}
