import { useInfiniteQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SelectableCommandList } from "@/components/selectable-command-list"
import { Button } from "@/components/ui/button"
import { Command, CommandInput } from "@/components/ui/command"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchFeatureFlags } from "@/features/flags/flags-api"
import type { FeatureFlag } from "@/features/flags/flags-types"

const PAGE_SIZE = 20

function ProgressiveLoadMore({
  loading,
  error,
  onLoadMore,
}: {
  loading: boolean
  error: boolean
  onLoadMore: () => void
}) {
  const { t } = useTranslation()
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || loading || error) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: "120px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [error, loading, onLoadMore])

  return (
    <div ref={sentinelRef} className="flex min-h-12 justify-center px-2 py-2">
      {error ? (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <span>
            {t(
              "releaseDecision.experiments.detailsPage.exposure.flagSheet.loadMoreFailed"
            )}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onLoadMore}>
            {t("releaseDecision.experiments.retry")}
          </Button>
        </div>
      ) : loading ? (
        <Loader2 className="animate-spin text-muted-foreground" />
      ) : null}
    </div>
  )
}

export function FeatureFlagSheet({
  open,
  envId,
  currentFlagKey,
  saving,
  saveError,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  envId: string
  currentFlagKey: string | null
  saving: boolean
  saveError: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (flag: FeatureFlag) => Promise<void>
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const [selectedKey, setSelectedKey] = useState<string | null>(currentFlagKey)

  const flagsQuery = useInfiniteQuery({
    queryKey: ["experiment-flag-options", envId, deferredQuery],
    queryFn: ({ pageParam }) =>
      fetchFeatureFlags(envId, {
        name: deferredQuery,
        tags: [],
        isArchived: false,
        sortBy: "key",
        pageIndex: pageParam,
        pageSize: PAGE_SIZE,
      }),
    enabled: open && Boolean(envId),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      pages.length * PAGE_SIZE < lastPage.totalCount
        ? pages.length + 1
        : undefined,
  })

  const flags = useMemo(
    () => flagsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [flagsQuery.data]
  )
  const selectedFlag = flags.find((flag) => flag.key === selectedKey)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,592px)] data-[side=right]:sm:max-w-[592px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle className="text-lg font-semibold">
            {t(
              `releaseDecision.experiments.detailsPage.exposure.flagSheet.${currentFlagKey ? "changeTitle" : "title"}`
            )}
          </SheetTitle>
          <SheetDescription className="mt-1.5 leading-5">
            {t(
              "releaseDecision.experiments.detailsPage.exposure.flagSheet.subtitle"
            )}
          </SheetDescription>
        </SheetHeader>

        <Command
          shouldFilter={false}
          className="min-h-0 flex-1 rounded-none p-0"
        >
          <div className="px-6 pt-5 pb-1">
            <CommandInput
              value={query}
              placeholder={t(
                "releaseDecision.experiments.detailsPage.exposure.flagSheet.search"
              )}
              onValueChange={setQuery}
            />
          </div>
          <SelectableCommandList
            items={flags}
            getKey={(flag) => flag.id}
            getValue={(flag) => `${flag.name} ${flag.key}`}
            isSelected={(flag) => flag.key === selectedKey}
            onSelect={(flag) => setSelectedKey(flag.key)}
            listClassName="max-h-none flex-1 px-5 pb-4 [&_[data-slot=command-item]]:py-1"
            loading={flagsQuery.isLoading}
            loadingContent={
              <div className="space-y-2 px-2 py-1">
                {Array.from({ length: 7 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            }
            emptyContent={
              flagsQuery.isError ? (
                <div className="space-y-3">
                  <p className="text-destructive">
                    {t(
                      "releaseDecision.experiments.detailsPage.exposure.flagSheet.loadFailed"
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void flagsQuery.refetch()}
                  >
                    {t("releaseDecision.experiments.retry")}
                  </Button>
                </div>
              ) : (
                t(
                  "releaseDecision.experiments.detailsPage.exposure.flagSheet.empty"
                )
              )
            }
            renderItem={(flag) => (
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium" title={flag.name}>
                    {flag.name}
                  </p>
                  <code
                    className="inline-block max-w-full truncate rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    title={flag.key}
                  >
                    {flag.key}
                  </code>
                </div>
                <span className="flex items-center gap-2 text-xs">
                  <span
                    className={`size-2 rounded-full ${flag.isEnabled ? "bg-emerald-600" : "bg-zinc-400"}`}
                  />
                  {t(
                    `releaseDecision.experiments.detailsPage.exposure.flagSheet.${flag.isEnabled ? "on" : "off"}`
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {t(
                    `releaseDecision.experiments.detailsPage.exposure.flagSheet.${flag.variationType}`,
                    { defaultValue: flag.variationType }
                  )}
                </span>
              </div>
            )}
            afterItems={
              flagsQuery.hasNextPage || flagsQuery.isFetchNextPageError ? (
                <ProgressiveLoadMore
                  loading={flagsQuery.isFetchingNextPage}
                  error={flagsQuery.isFetchNextPageError}
                  onLoadMore={() => void flagsQuery.fetchNextPage()}
                />
              ) : null
            }
          />
        </Command>

        <SheetFooter className="flex-row items-center justify-between px-6 py-5">
          {saveError ? (
            <p className="text-sm text-destructive">
              {t(
                "releaseDecision.experiments.detailsPage.exposure.flagSheet.saveFailed"
              )}
            </p>
          ) : (
            <span />
          )}
          <Button
            type="button"
            disabled={!selectedFlag || saving}
            onClick={() => selectedFlag && void onConfirm(selectedFlag)}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {t(
              `releaseDecision.experiments.detailsPage.exposure.flagSheet.${saving ? "saving" : "confirm"}`
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
