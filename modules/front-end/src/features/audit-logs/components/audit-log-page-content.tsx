import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Lang } from "@/features/layout/layout-types"
import type { AuditLog } from "../audit-logs-types"
import type { AuditLogFilterState } from "../use-audit-log-filters"
import { AuditLogFilters } from "./audit-log-filters"
import { AuditLogRawDataDialog } from "./audit-log-raw-data-dialog"
import { AuditLogTable } from "./audit-log-table"

type AuditLogPageContentProps = {
  lang: Lang
  locale: string
  subtitle: string
  iam?: boolean
  filters: AuditLogFilterState
  items: AuditLog[]
  segmentNames?: ReadonlyMap<string, string>
  contextMissing: boolean
  loading: boolean
  initialError?: string
  nextPageError: boolean
  hasNextPage: boolean
  fetchingNextPage: boolean
  onRetry?: () => void
  onLoadMore: () => void
}

export function AuditLogPageContent({
  lang,
  locale,
  subtitle,
  iam = false,
  filters,
  items,
  segmentNames,
  contextMissing,
  loading,
  initialError,
  nextPageError,
  hasNextPage,
  fetchingNextPage,
  onRetry,
  onLoadMore,
}: AuditLogPageContentProps) {
  const { t } = useTranslation()
  const [rawData, setRawData] = useState<AuditLog | null>(null)
  const {
    search,
    user,
    refType,
    range,
    filtersApplied,
    setSearch,
    setUser,
    setRefType,
    setRange,
    clearFilters,
  } = filters

  if (contextMissing) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <p className="text-sm text-muted-foreground">
          {t("auditLogs.loadFailed")}
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <header className="mb-8 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("auditLogs.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </header>

        <div className="mb-5">
          <AuditLogFilters
            iam={iam}
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
              {initialError}
              {onRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                >
                  {t("auditLogs.retry")}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="min-w-[1120px]">
              <AuditLogTable
                iam={iam}
                items={items}
                segmentNames={segmentNames}
                lang={lang}
                locale={locale}
                loading={loading}
                filtered={filtersApplied}
                onClearFilters={clearFilters}
                onViewRawData={setRawData}
              />
            </div>
          )}
        </div>

        {hasNextPage || nextPageError ? (
          <div className="flex justify-center pt-5">
            <Button
              type="button"
              variant="outline"
              disabled={fetchingNextPage}
              onClick={onLoadMore}
            >
              {fetchingNextPage ? <Loader2 className="animate-spin" /> : null}
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
