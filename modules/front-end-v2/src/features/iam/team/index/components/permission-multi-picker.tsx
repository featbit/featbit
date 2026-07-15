import { Star, X } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SelectableCommandList } from "@/components/selectable-command-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandInput } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
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
  selected,
  onSelectedChange,
}: {
  selected: PolicyOption[]
  onSelectedChange: (options: PolicyOption[]) => void
}) {
  const { t } = useTranslation()
  return (
    <PermissionMultiPicker
      label={t("iam.team.add.policies")}
      selectedLabel={t("iam.team.add.selectedPolicies")}
      placeholder={t("iam.team.add.searchPolicies")}
      emptyType={t("iam.team.add.policies")}
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
  selected,
  onSelectedChange,
}: {
  selected: GroupOption[]
  onSelectedChange: (options: GroupOption[]) => void
}) {
  const { t } = useTranslation()
  return (
    <PermissionMultiPicker
      label={t("iam.team.add.groups")}
      selectedLabel={t("iam.team.add.selectedGroups")}
      placeholder={t("iam.team.add.searchGroups")}
      emptyType={t("iam.team.add.groups")}
      selected={selected}
      onSelectedChange={onSelectedChange}
      loadOptions={loadGroupOptions}
    />
  )
}

function PermissionMultiPicker<TOption extends { id: string; name: string }>({
  label,
  selectedLabel,
  placeholder,
  emptyType,
  selected,
  onSelectedChange,
  loadOptions,
  getOptionMeta,
}: {
  label: string
  selectedLabel: string
  placeholder: string
  emptyType: string
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
  const [searchActive, setSearchActive] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const requestVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const loadNextPageRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!searchActive) {
      return
    }

    let cancelled = false
    const version = requestVersion.current
    const timeout = window.setTimeout(() => {
      loadOptions(query, 0)
        .then((result) => {
          if (!cancelled && version === requestVersion.current) {
            setOptions(result.items)
            setTotalCount(result.totalCount)
            setPageIndex(0)
          }
        })
        .catch(() => {
          if (!cancelled) setOptions([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadOptions, query, searchActive])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) =>
      option.name.toLocaleLowerCase().includes(normalizedQuery)
    )
  }, [options, query])

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
    if (!searchActive) return

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
  }, [loading, loadingMore, options.length, searchActive, totalCount])

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {t("iam.team.add.selectedCount", { count: selected.length })}
        </span>
      </div>
      <div className="space-y-2 border-b bg-muted/30 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-foreground">
            {selectedLabel}
          </span>
          {selected.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onSelectedChange([])}
            >
              {t("iam.team.add.clearAll")}
            </Button>
          ) : null}
        </div>
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((option) => (
              <Badge
                key={option.id}
                variant="secondary"
                className="max-w-full gap-1 rounded-full border-border py-0.5 pr-1 pl-2 font-normal"
              >
                <span className="min-w-0 truncate">{option.name}</span>
                <button
                  type="button"
                  aria-label={t("iam.team.add.removeSelected", {
                    name: option.name,
                  })}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() =>
                    onSelectedChange(
                      selected.filter((item) => item.id !== option.id)
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("iam.team.add.noneSelected", { type: emptyType })}
          </p>
        )}
      </div>
      <Command
        shouldFilter={false}
        className="rounded-none p-0 [&_[data-slot=command-input-wrapper]]:p-0"
      >
        <div className="px-2 py-2">
          <CommandInput
            value={query}
            placeholder={placeholder}
            onFocus={() => {
              if (!searchActive) {
                requestVersion.current += 1
                setSearchActive(true)
                setOptions([])
                setPageIndex(0)
                setTotalCount(0)
                setLoadingMore(false)
                setLoading(true)
              }
            }}
            onValueChange={(nextQuery) => {
              requestVersion.current += 1
              setQuery(nextQuery)
              setOptions([])
              setPageIndex(0)
              setTotalCount(0)
              setLoadingMore(false)
              setLoading(true)
            }}
          />
        </div>
        {searchActive ? (
          <SelectableCommandList
            items={filteredOptions}
            getKey={(option) => option.id}
            getValue={(option) => `${option.name} ${option.id}`}
            isSelected={(option) =>
              selected.some((item) => item.id === option.id)
            }
            onSelect={toggleOption}
            emptyContent={t("iam.team.add.noResults")}
            loading={loading}
            loadingContent={
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-4/5" />
              </div>
            }
            afterItems={
              <>
                {loadingMore ? (
                  <div className="p-2">
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : null}
                <div ref={loadMoreSentinelRef} className="h-px" aria-hidden />
              </>
            }
            listRef={listRef}
            listClassName="max-h-40 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto border-t pt-1 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
            renderItem={(option) => (
              <>
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                {getOptionMeta?.(option)}
              </>
            )}
          />
        ) : null}
      </Command>
    </div>
  )
}
