import { Star, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { RelationshipOption, RelationshipOptionPage } from "../../team-api"

export function RelationshipPickerSheet({
  open,
  title,
  kind,
  saving,
  loadOptions,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  title: string
  kind: "groups" | "policies"
  saving: boolean
  loadOptions: (
    query: string,
    pageIndex: number
  ) => Promise<RelationshipOptionPage>
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
  const requestVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadNextPageRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!open) return

    const version = ++requestVersion.current
    loadingMoreRef.current = false
    const timeout = window.setTimeout(() => {
      setLoadingMore(false)
      setLoading(true)
      setPageIndex(0)
      loadOptions(query, 0)
        .then((result) => {
          if (requestVersion.current !== version) return
          setOptions(result.items)
          setHasMore(result.hasMore)
        })
        .catch(() => {
          if (requestVersion.current === version) {
            setOptions([])
            setHasMore(false)
          }
        })
        .finally(() => {
          if (requestVersion.current === version) setLoading(false)
        })
    }, 200)

    return () => window.clearTimeout(timeout)
  }, [loadOptions, open, query])

  async function loadNextPage() {
    if (!hasMore || loading || loadingMoreRef.current) return

    const nextPage = pageIndex + 1
    const version = requestVersion.current
    loadingMoreRef.current = true
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
      // Keep the loaded pages visible so scrolling can retry the request.
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
    if (!root || !sentinel || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        void loadNextPageRef.current()
      },
      { root, rootMargin: "0px 0px 16px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, options.length])

  const selectedLabel =
    kind === "groups"
      ? t("iam.team.details.selectedGroups")
      : t("iam.team.details.selectedPolicies")
  const availableLabel =
    kind === "groups"
      ? t("iam.team.details.availableGroups")
      : t("iam.team.details.availablePolicies")
  const placeholder =
    kind === "groups"
      ? t("iam.team.details.searchGroups")
      : t("iam.team.details.searchPolicies")
  const hasQuery = Boolean(query.trim())
  const emptyMessage = hasQuery
    ? kind === "groups"
      ? t("iam.team.details.noMatchingGroups")
      : t("iam.team.details.noMatchingPolicies")
    : kind === "groups"
      ? t("iam.team.details.noAvailableGroups")
      : t("iam.team.details.noAvailablePolicies")
  const noSelectionMessage =
    kind === "groups"
      ? t("iam.team.details.noSelectedGroups")
      : t("iam.team.details.noSelectedPolicies")

  function toggleOption(option: RelationshipOption) {
    setSelected((current) =>
      current.some((item) => item.id === option.id)
        ? current.filter((item) => item.id !== option.id)
        : [...current, option]
    )
  }

  const selectedHeader = (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-foreground">
        {selectedLabel}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {t("iam.team.details.selectedCount", { count: selected.length })}
        </span>
        {selected.length ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => setSelected([])}
          >
            {t("iam.team.details.clearAll")}
          </Button>
        ) : null}
      </div>
    </div>
  )

  const selectedItems = selected.length ? (
    <div className="flex flex-wrap gap-1.5">
      {selected.map((option) => (
        <Badge
          key={option.id}
          variant="secondary"
          className="max-w-full gap-1 rounded-full border-border py-0.5 pr-1 pl-2 font-normal"
        >
          <span className="truncate">{option.name}</span>
          <button
            type="button"
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => toggleOption(option)}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  ) : null

  const selectedSection = (
    <section className="mb-3">
      {selectedHeader}
      <div className="mt-2 min-h-10 rounded-lg border bg-muted/30 px-3 py-2.5">
        {selectedItems ?? (
          <p className="text-xs leading-5 text-muted-foreground">
            {noSelectionMessage}
          </p>
        )}
      </div>
    </section>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,520px)] data-[side=right]:sm:max-w-[520px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-6 py-5">
          {selectedSection}
          <div className="text-sm font-medium text-foreground">
            {availableLabel}
          </div>
          <Command
            shouldFilter={false}
            className="h-auto min-h-0 flex-none overflow-hidden rounded-lg border p-0 [&_[data-slot=command-input-wrapper]]:p-0"
          >
            <div className="px-2 py-2">
              <CommandInput
                value={query}
                placeholder={placeholder}
                onValueChange={setQuery}
              />
            </div>
            <CommandList
              ref={listRef}
              className="max-h-80 flex-none [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto border-t p-1 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
            >
              {loading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                  <CommandGroup className="p-0 [&_[cmdk-group-items]]:space-y-1">
                    {options.map((option) => {
                      const isSelected = selected.some(
                        (item) => item.id === option.id
                      )
                      return (
                        <CommandItem
                          key={option.id}
                          value={`${option.name} ${option.id}`}
                          data-checked={isSelected}
                          className="items-start px-3 py-2.5 data-[checked=true]:bg-accent data-[checked=true]:text-accent-foreground"
                          onSelect={() => toggleOption(option)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 font-medium">
                              <span className="truncate">{option.name}</span>
                              {option.type === "SysManaged" ? (
                                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                                  <Star className="size-3" />
                                  {t("iam.team.details.systemManaged")}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                  {loadingMore ? (
                    <div className="p-2">
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : null}
                  <div ref={sentinelRef} className="h-px" aria-hidden />
                </>
              )}
            </CommandList>
          </Command>
        </div>

        <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            disabled={!selected.length || saving}
            onClick={() => onSubmit(selected)}
          >
            {kind === "policies"
              ? saving
                ? t("iam.team.details.attaching")
                : t("iam.team.details.attach")
              : saving
                ? t("iam.team.details.adding")
                : t("iam.team.details.add")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
