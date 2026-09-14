import { ListPaginationControls } from "@/components/list-pagination-controls"
import { useTranslation } from "react-i18next"

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
  const first = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const last = Math.min(totalCount, pageIndex * pageSize)

  return (
    <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div>
        {t("iam.team.pagination.summary", { first, last, total: totalCount })}
      </div>
      <ListPaginationControls
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageIndexChange={onPageIndexChange}
        onPageSizeChange={onPageSizeChange}
        perPage={(count) => t("iam.team.pagination.perPage", { count })}
      />
    </div>
  )
}
