import { ListPaginationControls } from "@/components/list-pagination-controls"
import { useTranslation } from "react-i18next"

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
  const from = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const to = Math.min(totalCount, pageIndex * pageSize)

  return (
    <div className="flex items-center justify-between gap-4 py-4 text-sm text-muted-foreground">
      <p>{t("accessTokens.showing", { from, to, total: totalCount })}</p>
      <ListPaginationControls
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageIndexChange={onPageIndexChange}
        onPageSizeChange={onPageSizeChange}
        perPage={(count) => t("accessTokens.perPage", { count })}
        previousLabel={t("accessTokens.previousPage")}
        nextLabel={t("accessTokens.nextPage")}
      />
    </div>
  )
}
