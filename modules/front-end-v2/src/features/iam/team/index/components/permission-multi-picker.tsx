import { Star } from "lucide-react"
import type { ReactNode, RefObject } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SelectedItemsField } from "@/components/selected-items-field"
import { SelectableCommandList } from "@/components/selectable-command-list"
import {
  SelectionFilterTabs,
  type SelectionFilter,
} from "@/components/selection-filter-tabs"
import { StablePopoverContent } from "@/components/stable-popover-content"
import { Button } from "@/components/ui/button"
import { Command, CommandInput } from "@/components/ui/command"
import { Popover } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  fetchGroupOptions,
  fetchPolicyOptions,
  type GroupOption,
  type PagedResult,
  type PolicyOption,
} from "../../team-api"

const loadPolicyOptions = (query: string, pageIndex: number) =>
  fetchPolicyOptions({ name: query, pageIndex })

const loadGroupOptions = (query: string, pageIndex: number) =>
  fetchGroupOptions({ name: query, pageIndex })

export function PolicyMultiPicker({
  portalContainer,
  selected,
  onSelectedChange,
}: {
  portalContainer: RefObject<HTMLElement | null>
  selected: PolicyOption[]
  onSelectedChange: (options: PolicyOption[]) => void
}) {
  const { t } = useTranslation()
  return (
    <PermissionMultiPicker
      label={t("iam.team.add.policies")}
      placeholder={t("iam.team.add.searchPolicies")}
      emptyType={t("iam.team.add.policies")}
      portalContainer={portalContainer}
      selected={selected}
      onSelectedChange={onSelectedChange}
      getOptionMeta={(item) =>
        item.type === "SysManaged" ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3" />
            {t("iam.team.add.system")}
          </span>
        ) : null
      }
      loadOptions={loadPolicyOptions}
    />
  )
}

export function GroupMultiPicker({
  portalContainer,
  selected,
  onSelectedChange,
}: {
  portalContainer: RefObject<HTMLElement | null>
  selected: GroupOption[]
  onSelectedChange: (options: GroupOption[]) => void
}) {
  const { t } = useTranslation()
  return (
    <PermissionMultiPicker
      label={t("iam.team.add.groups")}
      placeholder={t("iam.team.add.searchGroups")}
      emptyType={t("iam.team.add.groups")}
      portalContainer={portalContainer}
      selected={selected}
      onSelectedChange={onSelectedChange}
      loadOptions={loadGroupOptions}
    />
  )
}

function PermissionMultiPicker<TOption extends { id: string; name: string }>({
  label,
  placeholder,
  emptyType,
  portalContainer,
  selected,
  onSelectedChange,
  loadOptions,
  getOptionMeta,
}: {
  label: string
  placeholder: string
  emptyType: string
  portalContainer: RefObject<HTMLElement | null>
  selected: TOption[]
  onSelectedChange: (options: TOption[]) => void
  loadOptions: (
    query: string,
    pageIndex: number
  ) => Promise<PagedResult<TOption>>
  getOptionMeta?: (option: TOption) => ReactNode
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<TOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<SelectionFilter>("all")
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const requestVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const loadNextPageRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!open || filter !== "all" || loadedQuery === query) {
      return
    }

    let cancelled = false
    const version = requestVersion.current + 1
    requestVersion.current = version
    const resetTimeout = window.setTimeout(() => {
      setOptions([])
      setPageIndex(0)
      setTotalCount(0)
      setLoadingMore(false)
      setLoading(true)
    }, 0)
    const loadTimeout = window.setTimeout(() => {
      loadOptions(query, 0)
        .then((result) => {
          if (!cancelled && version === requestVersion.current) {
            setOptions(result.items)
            setTotalCount(result.totalCount)
            setPageIndex(0)
            setLoadedQuery(query)
          }
        })
        .catch(() => {
          if (!cancelled && version === requestVersion.current) {
            setOptions([])
            setLoadedQuery(query)
          }
        })
        .finally(() => {
          if (!cancelled && version === requestVersion.current) {
            setLoading(false)
          }
        })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(resetTimeout)
      window.clearTimeout(loadTimeout)
    }
  }, [filter, loadOptions, loadedQuery, open, query])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) =>
      option.name.toLocaleLowerCase().includes(normalizedQuery)
    )
  }, [options, query])

  const visibleOptions = useMemo(() => {
    if (filter === "all") return filteredOptions

    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return selected
    return selected.filter((option) =>
      option.name.toLocaleLowerCase().includes(normalizedQuery)
    )
  }, [filter, filteredOptions, query, selected])

  function toggleOption(option: TOption) {
    const exists = selected.some((item) => item.id === option.id)
    onSelectedChange(
      exists
        ? selected.filter((item) => item.id !== option.id)
        : [...selected, option]
    )
  }

  async function loadNextPage() {
    if (loading || loadingMoreRef.current || options.length >= totalCount) {
      return
    }

    const nextPageIndex = pageIndex + 1
    const version = requestVersion.current
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const result = await loadOptions(query, nextPageIndex)
      if (version !== requestVersion.current) return

      setOptions((current) => {
        const merged = new Map(current.map((option) => [option.id, option]))
        result.items.forEach((option) => merged.set(option.id, option))
        return Array.from(merged.values())
      })
      setTotalCount(result.totalCount)
      setPageIndex(nextPageIndex)
    } catch {
      // Keep the loaded pages visible so the user can retry by scrolling again.
    } finally {
      loadingMoreRef.current = false
      if (version === requestVersion.current) setLoadingMore(false)
    }
  }

  useEffect(() => {
    loadNextPageRef.current = loadNextPage
  })

  useEffect(() => {
    if (!open || filter !== "all") return

    const root = listRef.current
    const sentinel = loadMoreSentinelRef.current
    if (!root || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPageRef.current()
        }
      },
      { root, rootMargin: "0px 0px 8px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [filter, loading, loadingMore, open, options.length, totalCount])

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setFilter("all")
      }}
    >
      <SelectedItemsField
        items={selected}
        getKey={(option) => option.id}
        getLabel={(option) => option.name}
        heading={
          <>
            {label}
            <span className="ml-1 text-muted-foreground">
              ({selected.length})
            </span>
          </>
        }
        manageLabel={t("iam.team.manage.button")}
        emptyContent={t("iam.team.add.noneSelected", { type: emptyType })}
        removeLabel={(option) =>
          t("iam.team.add.removeSelected", { name: option.name })
        }
        onRemove={(option) =>
          onSelectedChange(selected.filter((item) => item.id !== option.id))
        }
      />
      <StablePopoverContent
        portalContainer={portalContainer}
        align="start"
        className="w-[min(28rem,calc(100vw-2rem))] p-0"
      >
        <Command shouldFilter={false} className="rounded-md">
          <CommandInput
            value={query}
            placeholder={placeholder}
            onValueChange={setQuery}
          />
          <SelectionFilterTabs
            value={filter}
            onValueChange={setFilter}
            allLabel={t("iam.policies.details.permissionsEditor.allFilter")}
            selectedLabel={(count) =>
              t("iam.policies.details.permissionsEditor.selectedFilter", {
                count,
              })
            }
            selectedCount={selected.length}
          />
          <SelectableCommandList
            items={visibleOptions}
            getKey={(option) => option.id}
            getValue={(option) => `${option.name} ${option.id}`}
            isSelected={(option) =>
              selected.some((item) => item.id === option.id)
            }
            onSelect={toggleOption}
            emptyContent={
              filter === "selected"
                ? t("iam.team.add.noneSelected", { type: emptyType })
                : t("iam.team.add.noResults")
            }
            loading={filter === "all" && (loading || loadedQuery !== query)}
            loadingContent={
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-4/5" />
              </div>
            }
            afterItems={
              filter === "all" ? (
                <>
                  {loadingMore ? (
                    <div className="p-2">
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : null}
                  <div ref={loadMoreSentinelRef} className="h-px" aria-hidden />
                </>
              ) : null
            }
            listRef={listRef}
            listClassName="max-h-[clamp(10rem,40dvh,18rem)] [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto [&_[data-slot=command-empty]]:flex [&_[data-slot=command-empty]]:min-h-20 [&_[data-slot=command-empty]]:items-center [&_[data-slot=command-empty]]:justify-center [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
            renderItem={(option) => (
              <>
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                {getOptionMeta?.(option)}
              </>
            )}
          />
        </Command>
        <div className="flex items-center justify-between border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelectedChange([])}
            disabled={!selected.length}
          >
            {t("iam.team.add.clearAll")}
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            {t("iam.policies.details.permissionsEditor.done")}
          </Button>
        </div>
      </StablePopoverContent>
    </Popover>
  )
}
