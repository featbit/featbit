import { Star, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useEffect, useMemo, useRef, useState } from "react"
import { SelectableCommandList } from "@/components/selectable-command-list"
import {
  SelectionFilterTabs,
  type SelectionFilter,
} from "@/components/selection-filter-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandInput } from "@/components/ui/command"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  RelationshipOption,
  RelationshipOptionPage,
} from "../../group-api"

export function RelationshipPickerSheet({
  open,
  title,
  kind,
  saving,
  loadOptions,
  noAvailableMessage,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  title: string
  kind: "members" | "policies"
  saving: boolean
  loadOptions: (
    query: string,
    pageIndex: number
  ) => Promise<RelationshipOptionPage>
  noAvailableMessage?: string
  onOpenChange: (open: boolean) => void
  onSubmit: (selected: RelationshipOption[]) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<RelationshipOption[]>([])
  const [selected, setSelected] = useState<RelationshipOption[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [initialLoadErrorQuery, setInitialLoadErrorQuery] = useState<
    string | undefined
  >()
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const [filter, setFilter] = useState<SelectionFilter>("all")
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadNextPageRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!open || filter !== "all") return

    const version = ++requestVersion.current
    loadingMoreRef.current = false
    const resetTimeout = window.setTimeout(() => {
      if (requestVersion.current !== version) return
      setOptions([])
      setLoadingMore(false)
      setInitialLoadErrorQuery(undefined)
      setLoadMoreError(false)
      setLoading(true)
      setPageIndex(0)
      setLoadedQuery(null)
    }, 0)
    const loadTimeout = window.setTimeout(
      () => {
        loadOptions(query, 0)
          .then((result) => {
            if (requestVersion.current !== version) return
            setOptions(result.items)
            setHasMore(result.hasMore)
            setLoadedQuery(query)
            setInitialLoadErrorQuery(undefined)
          })
          .catch(() => {
            if (requestVersion.current === version) {
              setOptions([])
              setHasMore(false)
              setLoadedQuery(query)
              setInitialLoadErrorQuery(query)
            }
          })
          .finally(() => {
            if (requestVersion.current === version) setLoading(false)
          })
      },
      query.trim() ? 200 : 0
    )

    return () => {
      window.clearTimeout(resetTimeout)
      window.clearTimeout(loadTimeout)
    }
  }, [filter, loadOptions, open, query, retryVersion])

  async function loadNextPage(forceRetry = false) {
    if (
      !hasMore ||
      loading ||
      loadingMoreRef.current ||
      (loadMoreError && !forceRetry)
    )
      return

    const nextPage = pageIndex + 1
    const version = requestVersion.current
    loadingMoreRef.current = true
    setLoadMoreError(false)
    setLoadingMore(true)
    try {
      const result = await loadOptions(query, nextPage)
      if (requestVersion.current !== version) return
      setOptions((current) => {
        const merged = new Map(current.map((item) => [item.id, item]))
        result.items.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })
      setPageIndex(nextPage)
      setHasMore(result.hasMore)
    } catch {
      if (requestVersion.current === version) setLoadMoreError(true)
    } finally {
      loadingMoreRef.current = false
      if (requestVersion.current === version) setLoadingMore(false)
    }
  }

  useEffect(() => {
    loadNextPageRef.current = loadNextPage
  })

  useEffect(() => {
    const root = listRef.current
    const sentinel = sentinelRef.current
    if (
      filter !== "all" ||
      !root ||
      !sentinel ||
      !hasMore ||
      loading ||
      loadingMore ||
      loadMoreError
    )
      return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPageRef.current()
        }
      },
      { root, rootMargin: "0px 0px 16px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [filter, hasMore, loading, loadingMore, loadMoreError, options.length])

  const isMembers = kind === "members"
  const selectedLabel = isMembers
    ? t("iam.groups.selectedMembers")
    : t("iam.groups.selectedPolicies")
  const placeholder = isMembers
    ? t("iam.groups.searchMembers")
    : t("iam.groups.searchPolicies")
  const normalizedQuery = query.trim()
  const hasQuery = Boolean(normalizedQuery)
  const initialLoadFailed = initialLoadErrorQuery === query
  const emptyMessage = hasQuery
    ? isMembers
      ? t("iam.groups.noMatchingMembers")
      : t("iam.groups.noMatchingPolicies")
    : (noAvailableMessage ??
      (isMembers
        ? t("iam.groups.noAvailableMembers")
        : t("iam.groups.noAvailablePolicies")))
  const noSelectionMessage = isMembers
    ? t("iam.groups.noSelectedMembers")
    : t("iam.groups.noSelectedPolicies")

  const visibleOptions = useMemo(() => {
    if (filter === "all") {
      return loadedQuery === query ? options : []
    }

    const normalizedSelectedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedSelectedQuery) return selected
    return selected.filter((option) =>
      `${option.name} ${option.email || ""} ${option.description || ""}`
        .toLocaleLowerCase()
        .includes(normalizedSelectedQuery)
    )
  }, [filter, loadedQuery, options, query, selected])

  function toggle(option: RelationshipOption) {
    const nextSelected = selected.some((item) => item.id === option.id)
      ? selected.filter((item) => item.id !== option.id)
      : [...selected, option]

    setSelected(nextSelected)
    if (filter === "selected" && !nextSelected.length) setFilter("all")
  }

  function clearSelected() {
    setSelected([])
    if (filter === "selected") setFilter("all")
  }

  function retryInitialLoad() {
    setInitialLoadErrorQuery(undefined)
    setLoading(true)
    setRetryVersion((current) => current + 1)
  }

  const relationshipSearchEmptyContent = (
    <div className="flex flex-col items-center gap-2 px-3 text-center">
      <p className="max-w-full text-sm break-words text-muted-foreground">
        {t(
          isMembers
            ? filter === "selected"
              ? "iam.groups.noMatchingSelectedMembersWithQuery"
              : "iam.groups.noMatchingMembersWithQuery"
            : filter === "selected"
              ? "iam.groups.noMatchingSelectedPoliciesWithQuery"
              : "iam.groups.noMatchingPoliciesWithQuery",
          { query: normalizedQuery }
        )}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setQuery("")}
      >
        {t("iam.groups.clearSearch")}
      </Button>
    </div>
  )

  const initialLoadErrorContent = (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 px-3 text-center"
    >
      <p className="text-sm text-destructive">
        {t(
          isMembers
            ? "iam.groups.membersLoadFailed"
            : "iam.groups.policiesLoadFailed"
        )}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={retryInitialLoad}
      >
        {t("iam.groups.retry")}
      </Button>
    </div>
  )

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setFilter("all")
        onOpenChange(nextOpen)
      }}
    >
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,520px)] data-[side=right]:sm:max-w-[520px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
          <section>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                {selectedLabel}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {t("iam.groups.selectedCount", { count: selected.length })}
                </span>
                {selected.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    onClick={clearSelected}
                  >
                    {t("iam.groups.clearAll")}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-2 min-h-10 rounded-lg border bg-muted/30 px-3 py-2.5">
              {selected.length ? (
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {selected.map((option) => (
                    <Badge
                      key={option.id}
                      variant="secondary"
                      className="max-w-full gap-1 rounded-full border-border py-0.5 pr-1 pl-2 font-normal"
                    >
                      <span className="truncate">{option.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`${t("iam.groups.remove")} ${option.name}`}
                        className="rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                        onClick={() => toggle(option)}
                      >
                        <X className="size-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  {noSelectionMessage}
                </p>
              )}
            </div>
          </section>
          <Command
            shouldFilter={false}
            className="h-auto min-h-0 flex-none overflow-hidden rounded-lg border-0 p-0 [&_[data-slot=command-input-wrapper]]:p-0 [&_[data-slot=input-group]]:border-input! [&_[data-slot=input-group]]:bg-background!"
          >
            <div className="py-2">
              <CommandInput
                value={query}
                placeholder={placeholder}
                onValueChange={setQuery}
              />
            </div>
            <SelectionFilterTabs
              value={filter}
              onValueChange={setFilter}
              allLabel={t("iam.groups.allFilter")}
              selectedLabel={(count) =>
                t("iam.groups.selectedFilter", { count })
              }
              selectedCount={selected.length}
            />
            <SelectableCommandList
              items={visibleOptions}
              getKey={(option) => option.id}
              getValue={(option) =>
                `${option.name} ${option.email || ""} ${option.description || ""} ${option.id}`
              }
              isSelected={(option) =>
                selected.some((item) => item.id === option.id)
              }
              onSelect={toggle}
              emptyContent={
                initialLoadFailed
                  ? initialLoadErrorContent
                  : hasQuery
                    ? relationshipSearchEmptyContent
                    : filter === "selected"
                      ? noSelectionMessage
                      : emptyMessage
              }
              loading={filter === "all" && (loading || loadedQuery !== query)}
              loadingContent={
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              }
              afterItems={
                filter === "all" ? (
                  <>
                    {loadingMore ? (
                      <div className="p-2">
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : null}
                    {loadMoreError ? (
                      <div
                        role="alert"
                        className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-destructive"
                      >
                        <span>
                          {t(
                            isMembers
                              ? "iam.groups.membersLoadMoreFailed"
                              : "iam.groups.policiesLoadMoreFailed"
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => void loadNextPage(true)}
                        >
                          {t("iam.groups.retry")}
                        </Button>
                      </div>
                    ) : null}
                    <div ref={sentinelRef} className="h-px" aria-hidden />
                  </>
                ) : null
              }
              listRef={listRef}
              listClassName="max-h-96 flex-none [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto p-1 [&_[data-slot=command-empty]]:flex [&_[data-slot=command-empty]]:min-h-32 [&_[data-slot=command-empty]]:items-center [&_[data-slot=command-empty]]:justify-center [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
              renderItem={(option) => (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="truncate">{option.name}</span>
                    {option.type === "SysManaged" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground">
                        <Star className="size-3" />
                        {t("iam.groups.system")}
                      </span>
                    ) : null}
                  </div>
                  {option.email || option.description ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {option.email || option.description}
                    </p>
                  ) : null}
                </div>
              )}
            />
          </Command>
        </div>
        <SheetFooter className="bg-background px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            disabled={!selected.length || saving}
            onClick={() => onSubmit(selected)}
          >
            {saving ? t("iam.groups.adding") : t("iam.groups.add")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
