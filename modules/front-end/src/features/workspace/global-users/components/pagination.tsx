import { useTranslation } from "react-i18next"
import { ListPaginationControls } from "@/components/list-pagination-controls"

export function Pagination({
  pageIndex,
  pageSize,
  totalCount,
  showSummary = true,
  disabled = false,
  onPageIndexChange,
  onPageSizeChange,
}: {
  pageIndex: number
  pageSize: number
  totalCount: number
  showSummary?: boolean
  disabled?: boolean
  onPageIndexChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const { t } = useTranslation()
  const first = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const last = Math.min(totalCount, pageIndex * pageSize)

  return (
    <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      {showSummary ? (
        <div>
          {t("workspace.globalUsers.pagination.summary", {
            first,
            last,
            total: totalCount,
          })}
        </div>
      ) : (
        <div />
      )}
      <ListPaginationControls
        disabled={disabled}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageIndexChange={onPageIndexChange}
        onPageSizeChange={onPageSizeChange}
        perPage={(size) =>
          t("workspace.globalUsers.pagination.pageSize", { size })
        }
      />
    </div>
  )
}
