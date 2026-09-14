import { ListPaginationControls } from "@/components/list-pagination-controls"
import { useTranslation } from "react-i18next"
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
  const from = (pageIndex - 1) * pageSize + 1
  const to = Math.min(pageIndex * pageSize, totalCount)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>{t("featureFlags.showing", { from, to, total: totalCount })}</span>
      <ListPaginationControls
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        disabled={disabled}
        onPageIndexChange={onPageIndexChange}
        onPageSizeChange={onPageSizeChange}
        perPage={(count) => t("featureFlags.perPage", { count })}
        previousLabel={t("featureFlags.previous")}
        nextLabel={t("featureFlags.next")}
      />
    </div>
  )
}
