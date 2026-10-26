import { AuditLogScopes } from "./audit-logs-types"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import {
  getCurrentProjectEnv,
  resolveLang,
} from "@/features/layout/layout-context"
import { dayAfter, startOfDay } from "./audit-log-utils"
import { fetchAuditLogs } from "./audit-logs-api"
import { useAuditLogFilters } from "./use-audit-log-filters"
import { AuditLogPageContent } from "./components/audit-log-page-content"
import { useAuditLogSegmentNames } from "./components/audit-log-table-adapter"

const PAGE_SIZE = 10

export function AuditLogsPage() {
  const { t, i18n } = useTranslation()
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const locale = i18n.resolvedLanguage || lang
  const envId = getCurrentProjectEnv()?.envId ?? ""
  const filters = useAuditLogFilters()
  const { debouncedSearch, user, refType, range } = filters

  const logsQuery = useInfiniteQuery({
    queryKey: [
      "audit-logs",
      envId,
      debouncedSearch,
      user?.id,
      refType,
      range?.from?.toISOString(),
      range?.to?.toISOString(),
    ],
    queryFn: ({ pageParam }) =>
      fetchAuditLogs(
        {
          scope: AuditLogScopes.Environment,
          scopeId: envId,
          query: debouncedSearch,
          creatorId: user?.id,
          refTypes: refType ? [refType] : ["FeatureFlag", "Segment"],
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
    enabled: Boolean(envId),
  })

  const items = useMemo(
    () => logsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [logsQuery.data]
  )
  const segmentNames = useAuditLogSegmentNames(envId, items)

  return (
    <AuditLogPageContent
      lang={lang}
      locale={locale}
      subtitle={t("auditLogs.subtitle")}
      filters={filters}
      items={items}
      segmentNames={segmentNames}
      contextMissing={!envId}
      loading={logsQuery.isLoading}
      initialError={
        logsQuery.isError && items.length === 0
          ? t("auditLogs.loadFailed")
          : undefined
      }
      nextPageError={logsQuery.isError && items.length > 0}
      hasNextPage={logsQuery.hasNextPage}
      fetchingNextPage={logsQuery.isFetchingNextPage}
      onRetry={() => void logsQuery.refetch()}
      onLoadMore={() => void logsQuery.fetchNextPage()}
    />
  )
}
