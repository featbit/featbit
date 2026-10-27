import { AuditLogScopes } from "./audit-logs-types"
import { ApiRequestError } from "@/lib/api/authenticated-api"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useMemo, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import {
  getCurrentWorkspace,
  getCurrentOrganization,
  onCurrentOrganizationChanged,
  resolveLang,
} from "@/features/layout/layout-context"
import { dayAfter, startOfDay } from "./audit-log-utils"
import { fetchAuditLogs } from "./audit-logs-api"
import { useAuditLogFilters } from "./use-audit-log-filters"
import { AuditLogPageContent } from "./components/audit-log-page-content"

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
  const filters = useAuditLogFilters()
  const { debouncedSearch, user, refType, range } = filters

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
      fetchAuditLogs(
        {
          scope: AuditLogScopes.Organization,
          scopeId: orgId,
          query: debouncedSearch,
          creatorId: user?.id,
          refTypes: refType ? [refType] : ["Member", "Group", "Policy"],
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

  const forbidden =
    logsQuery.error instanceof ApiRequestError && logsQuery.error.status === 403

  return (
    <AuditLogPageContent
      iam
      lang={lang}
      locale={locale}
      subtitle={t("auditLogs.iamSubtitle")}
      filters={filters}
      items={items}
      contextMissing={!workspaceId}
      loading={logsQuery.isLoading}
      initialError={
        logsQuery.isError && items.length === 0
          ? t(forbidden ? "auditLogs.forbidden" : "auditLogs.loadFailed")
          : undefined
      }
      nextPageError={logsQuery.isError && items.length > 0}
      hasNextPage={logsQuery.hasNextPage}
      fetchingNextPage={logsQuery.isFetchingNextPage}
      onRetry={forbidden ? undefined : () => void logsQuery.refetch()}
      onLoadMore={() => void logsQuery.fetchNextPage()}
    />
  )
}
