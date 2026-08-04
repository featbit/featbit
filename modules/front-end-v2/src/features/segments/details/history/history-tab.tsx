import { useInfiniteQuery } from "@tanstack/react-query"
import { Info, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  dayAfter,
  hasAppliedFilters,
  startOfDay,
} from "@/features/audit-logs/audit-log-utils"
import { fetchAuditLogs } from "@/features/audit-logs/audit-logs-api"
import type {
  AuditLog,
  AuditUser,
} from "@/features/audit-logs/audit-logs-types"
import { AuditLogFilters } from "@/features/audit-logs/components/audit-log-filters"
import { AuditLogRawDataDialog } from "@/features/audit-logs/components/audit-log-raw-data-dialog"
import { AuditLogTable } from "@/features/audit-logs/components/audit-log-table"
import type { Lang } from "@/features/layout/layout-types"
import type { Segment } from "../../segments-types"
import { useSegmentAuditLogAdapter } from "./segment-audit-log-adapter"

const PAGE_SIZE = 10

export function HistoryTab({
  envId,
  segment,
  lang,
}: {
  envId: string
  segment: Segment
  lang: Lang
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage || lang
  const adapter = useSegmentAuditLogAdapter()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [user, setUser] = useState<AuditUser | null>(null)
  const [range, setRange] = useState<DateRange | undefined>()
  const [rawData, setRawData] = useState<AuditLog | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      400
    )
    return () => window.clearTimeout(timeout)
  }, [search])

  const filtersApplied = hasAppliedFilters({
    query: search,
    creatorId: user?.id,
    from: range?.from,
    to: range?.to,
  })
  const logsQuery = useInfiniteQuery({
    queryKey: [
      "segment-history",
      envId,
      segment.id,
      segment.type,
      debouncedSearch,
      user?.id,
      range?.from?.toISOString(),
      range?.to?.toISOString(),
    ],
    queryFn: ({ pageParam }) =>
      fetchAuditLogs(
        envId,
        {
          query: debouncedSearch,
          creatorId: user?.id,
          refType: "Segment",
          refId: segment.id,
          crossEnvironment: segment.type === "shared",
          from: range?.from ? startOfDay(range.from) : undefined,
          to: range?.to ? dayAfter(range.to) : undefined,
        },
        pageParam,
        PAGE_SIZE
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0)
      return loaded < lastPage.totalCount ? pages.length : undefined
    },
    enabled: Boolean(envId && segment.id),
  })
  const items = useMemo(
    () => logsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [logsQuery.data]
  )

  function clearFilters() {
    setSearch("")
    setDebouncedSearch("")
    setUser(null)
    setRange(undefined)
  }

  const initialError = logsQuery.isError && items.length === 0
  const nextPageError = logsQuery.isError && items.length > 0

  return (
    <div className="space-y-5 py-5">
      <AuditLogFilters
        locale={locale}
        search={search}
        user={user}
        refType="Segment"
        range={range}
        filtersApplied={filtersApplied}
        showRefType={false}
        endContent={
          segment.type === "shared" ? (
            <div className="flex items-center gap-2 text-sm text-primary">
              {t("segments.detailsPage.history.acrossScopes", {
                count: segment.scopes.length,
              })}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      aria-label={t(
                        "segments.detailsPage.history.acrossScopesHelp"
                      )}
                    />
                  }
                >
                  <Info className="size-4" />
                </TooltipTrigger>
                <TooltipContent>
                  {t("segments.detailsPage.history.acrossScopesHelp")}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : undefined
        }
        onSearchChange={setSearch}
        onUserChange={setUser}
        onRefTypeChange={() => undefined}
        onRangeChange={setRange}
        onClear={clearFilters}
      />

      <div className="overflow-x-auto rounded-md border bg-background">
        {initialError ? (
          <div className="flex min-h-40 items-center justify-between gap-4 px-5 py-4 text-sm text-destructive">
            {t("auditLogs.loadFailed")}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void logsQuery.refetch()}
            >
              {t("auditLogs.retry")}
            </Button>
          </div>
        ) : (
          <div className="min-w-[920px]">
            <AuditLogTable
              items={items}
              lang={lang}
              locale={locale}
              loading={logsQuery.isLoading}
              filtered={filtersApplied}
              resourceScoped
              adapter={adapter}
              onClearFilters={clearFilters}
              onViewRawData={setRawData}
            />
          </div>
        )}
      </div>

      {logsQuery.hasNextPage || nextPageError ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={logsQuery.isFetchingNextPage}
            onClick={() => void logsQuery.fetchNextPage()}
          >
            {logsQuery.isFetchingNextPage ? (
              <Loader2 className="animate-spin" />
            ) : null}
            {nextPageError ? t("auditLogs.retry") : t("auditLogs.loadMore")}
          </Button>
        </div>
      ) : null}

      <AuditLogRawDataDialog
        auditLog={rawData}
        locale={locale}
        onOpenChange={(open) => !open && setRawData(null)}
      />
    </div>
  )
}
