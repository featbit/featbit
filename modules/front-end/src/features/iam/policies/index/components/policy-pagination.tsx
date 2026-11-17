import { ListPaginationControls } from "@/components/list-pagination-controls"

export function PolicyPagination({
  pageIndex,
  pageSize,
  totalCount,
  summary,
  perPage,
  previousLabel,
  nextLabel,
  onPageIndexChange,
  onPageSizeChange,
}: {
  pageIndex: number
  pageSize: number
  totalCount: number
  summary: (first: number, last: number, total: number) => string
  perPage: (count: number) => string
  previousLabel: string
  nextLabel: string
  onPageIndexChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const first = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const last = Math.min(totalCount, pageIndex * pageSize)

  return (
    <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div>{summary(first, last, totalCount)}</div>
      <ListPaginationControls
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageIndexChange={onPageIndexChange}
        onPageSizeChange={onPageSizeChange}
        perPage={perPage}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
      />
    </div>
  )
}
