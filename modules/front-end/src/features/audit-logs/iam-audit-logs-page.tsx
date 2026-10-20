import { ApiRequestError } from "@/lib/api/authenticated-api"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import type { DateRange } from "react-day-picker"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  getCurrentWorkspace,
  getCurrentOrganization,
  onCurrentOrganizationChanged,
  resolveLang,
} from "@/features/layout/layout-context"
import { dayAfter, hasAppliedFilters, startOfDay } from "./audit-log-utils"
import { fetchIamAuditLogs } from "./audit-logs-api"
import type { AuditLog, AuditUser } from "./audit-logs-types"
import { AuditLogFilters } from "./components/audit-log-filters"
import { AuditLogRawDataDialog } from "./components/audit-log-raw-data-dialog"
import { AuditLogTable } from "./components/audit-log-table"

const PAGE_SIZE = 10

export function IamAuditLogsPage() {
  const orgId = useSyncExternalStore(
    onCurrentOrganizationChanged,
    () => getCurrentOrganization()?.id ?? ""
  )
  return (
    <OrganizationAuditLogsPage key={`${getCurrentWorkspace()?.id}:${orgId}`} />
  )
}

function OrganizationAuditLogsPage() {
  const { t, i18n } = useTranslation()
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const locale = i18n.resolvedLanguage || lang
  const orgId = getCurrentOrganization()?.id ?? ""
  const workspaceId = getCurrentWorkspace()?.id ?? ""
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [user, setUser] = useState<AuditUser | null>(null)
  const [refType, setRefType] = useState("")
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
    refType,
    from: range?.from,
    to: range?.to,
  })

  const logsQuery = useInfiniteQuery({
    queryKey: [
      "iam-audit-logs",
      orgId,
      workspaceId,
      debouncedSearch,
      user?.id,
      refType,
      range?.from?.toISOString(),
      range?.to?.toISOString(),
    ],
    queryFn: ({ pageParam }) =>
      fetchIamAuditLogs(
        {
          query: debouncedSearch,
          creatorId: user?.id,
          refType: refType || undefined,
          from: range?.from ? startOfDay(range.from) : undefined,
          to: range?.to ? dayAfter(range.to) : undefined,
        },
        pageParam,
        PAGE_SIZE
      ),
    retry: (count, error) =>
      !(error instanceof ApiRequestError && error.status === 403) && count < 2,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0)
      return loaded < lastPage.totalCount ? pages.length : undefined
    },
    enabled: Boolean(workspaceId && orgId),
  })

  const items = useMemo(
    () => logsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [logsQuery.data]
  )

  function clearFilters() {
    setSearch("")
    setDebouncedSearch("")
    setUser(null)
    setRefType("")
    setRange(undefined)
  }

  if (!workspaceId) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <p className="text-sm text-muted-foreground">
          {t("auditLogs.loadFailed")}
        </p>
      </div>
    )
  }

  const initialError = logsQuery.isError && items.length === 0
  const forbidden =
    logsQuery.error instanceof ApiRequestError && logsQuery.error.status === 403
  const nextPageError = logsQuery.isError && items.length > 0

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <header className="mb-8 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("auditLogs.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auditLogs.iamSubtitle")}
          </p>
        </header>

        <div className="mb-5">
          <AuditLogFilters
            iam
            locale={locale}
            search={search}
            user={user}
            refType={refType}
            range={range}
            filtersApplied={filtersApplied}
            onSearchChange={setSearch}
            onUserChange={setUser}
            onRefTypeChange={setRefType}
            onRangeChange={setRange}
            onClear={clearFilters}
          />
        </div>

        <div className="overflow-x-auto rounded-md border bg-background">
          {initialError ? (
            <div className="flex min-h-40 items-center justify-between gap-4 px-5 py-4 text-sm text-destructive">
              {t(forbidden ? "auditLogs.forbidden" : "auditLogs.loadFailed")}
              {!forbidden ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void logsQuery.refetch()}
                >
                  {t("auditLogs.retry")}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="min-w-[1120px]">
              <AuditLogTable
                iam
                items={items}
                lang={lang}
                locale={locale}
                loading={logsQuery.isLoading}
                filtered={filtersApplied}
                onClearFilters={clearFilters}
                onViewRawData={setRawData}
              />
            </div>
          )}
        </div>

        {logsQuery.hasNextPage || nextPageError ? (
          <div className="flex justify-center pt-5">
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
    </TooltipProvider>
  )
}
