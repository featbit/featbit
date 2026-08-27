import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import type { OrganizationMember } from "@/features/organization/organization-members-api"
import {
  getCurrentProjectEnv,
  getCurrentWorkspace,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import {
  getLicenseStatus,
  isFeatureGranted,
  parseLicense,
} from "@/features/workspace/license/license-utils"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import { cn } from "@/lib/utils"
import {
  fetchChangeRequests,
  performChangeRequestAction,
} from "./change-requests-api"
import type {
  ChangeRequestItem,
  ChangeRequestAction,
  ChangeRequestStatus,
} from "./change-requests-types"
import { ChangeRequestFilters } from "./components/change-request-filters"
import { ChangeRequestsLicenseGate } from "./components/change-requests-license-gate"
import { ChangeRequestTable } from "./components/change-request-table"
import { ChangeRequestDecisionDialog } from "./components/change-request-decision-dialog"

const PAGE_SIZE = 20

function ChangeRequestsHeader({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <header className={cn("mb-8 space-y-1", className)}>
      <h1 className="text-2xl font-semibold tracking-normal">
        {t("changeRequests.title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("changeRequests.subtitle")}
      </p>
    </header>
  )
}

export function ChangeRequestsPage() {
  const { t } = useTranslation()
  const { lang: langParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const lang = resolveLang(langParam)
  const projectEnv = getCurrentProjectEnv()
  const workspace = getCurrentWorkspace()
  const envId = projectEnv?.envId ?? ""
  const currentUserId = getStoredUserProfile().id
  const focusedChangeRequestId =
    searchParams.get("changeRequestId")?.trim() ?? ""
  const queryClient = useQueryClient()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [author, setAuthor] = useState<OrganizationMember | null>(null)
  const [reviewer, setReviewer] = useState<OrganizationMember | null>(null)
  const [status, setStatus] = useState<ChangeRequestStatus>()
  const [decisionTarget, setDecisionTarget] = useState<{
    item: ChangeRequestItem
    action: Extract<ChangeRequestAction, "approve" | "decline">
  } | null>(null)
  const license = parseLicense(workspace?.license)
  const changeRequestsGranted = isFeatureGranted(
    { id: "change-request", labelKey: "", descriptionKey: "" },
    license,
    getLicenseStatus(license)
  )
  const manageLicenseHref = localizedPath(
    lang,
    getRuntimeEnv().hostingMode === "saas"
      ? "/workspace/billing"
      : "/workspace/license"
  )

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      350
    )
    return () => window.clearTimeout(timeout)
  }, [query])

  const filtersApplied = Boolean(
    focusedChangeRequestId || query.trim() || author || reviewer || status
  )
  const listQuery = useInfiniteQuery({
    queryKey: [
      "change-requests",
      envId,
      focusedChangeRequestId,
      debouncedQuery,
      author?.id,
      reviewer?.id,
      status,
    ],
    queryFn: ({ pageParam }) =>
      fetchChangeRequests(
        envId,
        {
          id: focusedChangeRequestId || undefined,
          query: debouncedQuery,
          creatorId: author?.id,
          reviewerId: reviewer?.id,
          status,
        },
        pageParam,
        PAGE_SIZE
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0)
      return loaded < lastPage.totalCount ? pages.length : undefined
    },
    enabled: Boolean(envId && changeRequestsGranted),
  })

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data]
  )
  const firstPage = listQuery.data?.pages[0]
  const needsReviewCount = firstPage?.needsReviewCount ?? 0
  const reviewMutation = useMutation({
    mutationFn: async ({
      item,
      action,
      comment,
    }: {
      item: ChangeRequestItem
      action: ChangeRequestAction
      comment?: string
    }) => {
      const success = await performChangeRequestAction(
        envId,
        item.id,
        action,
        comment
      )
      if (!success) {
        throw new Error(t("changeRequests.actionUnavailable"))
      }
      return { action, item }
    },
    onSuccess: ({ action, item }) => {
      setDecisionTarget(null)
      toast.success(t(`changeRequests.actionSucceeded.${action}`))
      void queryClient.invalidateQueries({
        queryKey: ["change-requests", envId],
      })
      void queryClient.invalidateQueries({
        queryKey: ["flag-pending-changes", envId],
      })
      if (action === "apply") {
        void queryClient.invalidateQueries({ queryKey: ["feature-flags"] })
        void queryClient.invalidateQueries({
          queryKey: ["feature-flag-details", envId, item.flagKey],
        })
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error &&
          error.message === t("changeRequests.actionUnavailable")
          ? t("changeRequests.actionUnavailable")
          : t("changeRequests.actionFailed")
      )
    },
  })
  const acting = reviewMutation.isPending
    ? {
        id: reviewMutation.variables.item.id,
        action: reviewMutation.variables.action,
      }
    : null

  function clearFilters() {
    setQuery("")
    setDebouncedQuery("")
    setAuthor(null)
    setReviewer(null)
    setStatus(undefined)
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete("changeRequestId")
    setSearchParams(nextSearchParams, { replace: true })
  }

  if (!envId) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <p className="text-sm text-muted-foreground">
          {t("changeRequests.selectEnvironment")}
        </p>
      </div>
    )
  }

  if (!changeRequestsGranted) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
        <ChangeRequestsHeader className="mb-10" />
        <ChangeRequestsLicenseGate manageLicenseHref={manageLicenseHref} />
      </div>
    )
  }

  const initialError = listQuery.isError && items.length === 0
  const nextPageError = listQuery.isError && items.length > 0

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
      <ChangeRequestsHeader />

      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <ChangeRequestFilters
            query={query}
            author={author}
            reviewer={reviewer}
            status={status}
            filtersApplied={filtersApplied}
            onQueryChange={setQuery}
            onAuthorChange={setAuthor}
            onReviewerChange={setReviewer}
            onStatusChange={setStatus}
            onClear={clearFilters}
          />
        </div>
        <div className="flex min-h-5 shrink-0 justify-end">
          {listQuery.isLoading ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("changeRequests.summary", { count: needsReviewCount })}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-background">
        {initialError ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-5 py-4 text-center">
            <div>
              <p className="text-sm font-medium text-destructive">
                {t("changeRequests.loadFailed")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("changeRequests.loadFailedHelp")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void listQuery.refetch()}
            >
              {t("changeRequests.retry")}
            </Button>
          </div>
        ) : (
          <div className="min-w-[1400px]">
            <TooltipProvider>
              <ChangeRequestTable
                items={items}
                initialExpandedId={focusedChangeRequestId || undefined}
                focused={Boolean(focusedChangeRequestId)}
                lang={lang}
                currentUserId={currentUserId}
                loading={listQuery.isLoading}
                filtered={filtersApplied}
                acting={acting}
                onAction={(item, action) => {
                  if (action === "apply") {
                    reviewMutation.mutate({ item, action })
                    return
                  }
                  setDecisionTarget({ item, action })
                }}
                onCopyKey={async (key) => {
                  try {
                    await navigator.clipboard.writeText(key)
                    toast.success(t("changeRequests.keyCopied"))
                  } catch {
                    toast.error(t("changeRequests.copyFailed"))
                  }
                }}
                onClearFilters={clearFilters}
              />
            </TooltipProvider>
          </div>
        )}
      </div>

      {decisionTarget ? (
        <ChangeRequestDecisionDialog
          key={`${decisionTarget.item.id}-${decisionTarget.action}`}
          action={decisionTarget.action}
          requestTitle={
            decisionTarget.item.reason?.trim() ||
            t("changeRequests.fallbackRequest")
          }
          saving={reviewMutation.isPending}
          onOpenChange={(open) => {
            if (!open) setDecisionTarget(null)
          }}
          onConfirm={(comment) =>
            reviewMutation.mutate({ ...decisionTarget, comment })
          }
        />
      ) : null}

      {listQuery.hasNextPage || nextPageError ? (
        <div className="flex justify-center pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={listQuery.isFetchingNextPage}
            onClick={() => void listQuery.fetchNextPage()}
          >
            {listQuery.isFetchingNextPage ? (
              <Loader2 className="animate-spin" />
            ) : null}
            {listQuery.isFetchingNextPage
              ? t("changeRequests.loadingMore")
              : nextPageError
                ? t("changeRequests.retry")
                : t("changeRequests.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
