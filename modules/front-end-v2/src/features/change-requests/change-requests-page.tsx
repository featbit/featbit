import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import {
  getCurrentProjectEnv,
  resolveLang,
} from "@/features/layout/layout-context"
import {
  fetchChangeRequests,
  performChangeRequestAction,
} from "./change-requests-api"
import { changeRequestsCopy } from "./change-requests-copy"
import type {
  ChangeRequestItem,
  ChangeRequestMember,
  ChangeRequestAction,
  ChangeRequestStatus,
} from "./change-requests-types"
import { ChangeRequestFilters } from "./components/change-request-filters"
import { ChangeRequestTable } from "./components/change-request-table"

const PAGE_SIZE = 20

export function ChangeRequestsPage() {
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const copy = changeRequestsCopy(lang)
  const projectEnv = getCurrentProjectEnv()
  const envId = projectEnv?.envId ?? ""
  const currentUserId = getStoredUserProfile().id
  const queryClient = useQueryClient()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [author, setAuthor] = useState<ChangeRequestMember | null>(null)
  const [reviewer, setReviewer] = useState<ChangeRequestMember | null>(null)
  const [status, setStatus] = useState<ChangeRequestStatus>()

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      350
    )
    return () => window.clearTimeout(timeout)
  }, [query])

  const filtersApplied = Boolean(query.trim() || author || reviewer || status)
  const listQuery = useInfiniteQuery({
    queryKey: [
      "change-requests",
      envId,
      debouncedQuery,
      author?.id,
      reviewer?.id,
      status,
    ],
    queryFn: ({ pageParam }) =>
      fetchChangeRequests(
        envId,
        {
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
    enabled: Boolean(envId),
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
    }: {
      item: ChangeRequestItem
      action: ChangeRequestAction
    }) => {
      const success = await performChangeRequestAction(envId, item.id, action)
      if (!success) throw new Error(copy.actionUnavailable)
      return { action, item }
    },
    onSuccess: ({ action, item }) => {
      toast.success(copy.actionSucceeded(action))
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
        error instanceof Error && error.message === copy.actionUnavailable
          ? copy.actionUnavailable
          : copy.actionFailed
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
  }

  if (!envId) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <p className="text-sm text-muted-foreground">
          {copy.selectEnvironment}
        </p>
      </div>
    )
  }

  const initialError = listQuery.isError && items.length === 0
  const nextPageError = listQuery.isError && items.length > 0

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </header>

      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <ChangeRequestFilters
            query={query}
            author={author}
            reviewer={reviewer}
            status={status}
            filtersApplied={filtersApplied}
            copy={copy}
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
              {copy.summary(needsReviewCount)}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-background">
        {initialError ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-5 py-4 text-center">
            <div>
              <p className="text-sm font-medium text-destructive">
                {copy.loadFailed}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.loadFailedHelp}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void listQuery.refetch()}
            >
              {copy.retry}
            </Button>
          </div>
        ) : (
          <div className="min-w-[1400px]">
            <TooltipProvider>
              <ChangeRequestTable
                items={items}
                lang={lang}
                currentUserId={currentUserId}
                loading={listQuery.isLoading}
                filtered={filtersApplied}
                acting={acting}
                copy={copy}
                onAction={(item, action) =>
                  reviewMutation.mutate({ item, action })
                }
                onCopyKey={async (key) => {
                  try {
                    await navigator.clipboard.writeText(key)
                    toast.success(copy.keyCopied)
                  } catch {
                    toast.error(copy.copyFailed)
                  }
                }}
                onClearFilters={clearFilters}
              />
            </TooltipProvider>
          </div>
        )}
      </div>

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
              ? copy.loadingMore
              : nextPageError
                ? copy.retry
                : copy.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
