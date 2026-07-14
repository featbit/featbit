import { Star, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
import type { DetailsCopy } from "./details-copy"
import type { RelationshipOption, RelationshipOptionPage } from "./details-api"

export function RelationshipPickerSheet({
  open,
  title,
  kind,
  copy,
  saving,
  loadOptions,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  title: string
  kind: "groups" | "policies"
  copy: DetailsCopy
  saving: boolean
  loadOptions: (
    query: string,
    pageIndex: number
  ) => Promise<RelationshipOptionPage>
  onOpenChange: (open: boolean) => void
  onSubmit: (selected: RelationshipOption[]) => void
}) {
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<RelationshipOption[]>([])
  const [selected, setSelected] = useState<RelationshipOption[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestVersion = useRef(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const version = ++requestVersion.current
    const timeout = window.setTimeout(() => {
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

  useEffect(() => {
    const root = listRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return

        const nextPage = pageIndex + 1
        const version = requestVersion.current
        setLoadingMore(true)
        loadOptions(query, nextPage)
          .then((result) => {
            if (requestVersion.current !== version) return
            setOptions((current) => {
              const merged = new Map(current.map((item) => [item.id, item]))
              result.items.forEach((item) => merged.set(item.id, item))
              return Array.from(merged.values())
            })
            setPageIndex(nextPage)
            setHasMore(result.hasMore)
          })
          .finally(() => {
            if (requestVersion.current === version) setLoadingMore(false)
          })
      },
      { root, rootMargin: "0px 0px 16px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadOptions, loading, loadingMore, pageIndex, query])

  const selectedLabel =
    kind === "groups" ? copy.selectedGroups : copy.selectedPolicies
  const availableLabel =
    kind === "groups" ? copy.availableGroups : copy.availablePolicies
  const placeholder =
    kind === "groups" ? copy.searchGroups : copy.searchPolicies
  const emptyMessage =
    kind === "groups" ? copy.noAvailableGroups : copy.noAvailablePolicies

  function toggleOption(option: RelationshipOption) {
    setSelected((current) =>
      current.some((item) => item.id === option.id)
        ? current.filter((item) => item.id !== option.id)
        : [...current, option]
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,520px)] data-[side=right]:sm:max-w-[520px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-6 py-5">
          <Command
            shouldFilter={false}
            className="min-h-0 rounded-none p-0 [&_[data-slot=command-input-wrapper]]:p-0"
          >
            <CommandInput
              value={query}
              placeholder={placeholder}
              onValueChange={setQuery}
            />

            <section className="mt-5 rounded-lg border bg-muted/30 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  {selectedLabel}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {copy.selectedCount(selected.length)}
                  </span>
                  {selected.length ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs"
                      onClick={() => setSelected([])}
                    >
                      {copy.clearAll}
                    </Button>
                  ) : null}
                </div>
              </div>
              {selected.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
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
              ) : null}
            </section>

            <div className="mt-5 mb-2 text-sm font-medium text-foreground">
              {availableLabel}
            </div>
            <CommandList
              ref={listRef}
              className="max-h-80 min-h-40 flex-none [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto rounded-lg border p-1 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
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
                                  {copy.system}
                                </span>
                              ) : null}
                            </div>
                            {kind === "groups" && option.description ? (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {option.description}
                              </p>
                            ) : null}
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
                ? copy.attaching
                : copy.attach
              : saving
                ? copy.adding
                : copy.add}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
