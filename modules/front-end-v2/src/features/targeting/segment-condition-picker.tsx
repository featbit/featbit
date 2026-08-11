import { useQuery } from "@tanstack/react-query"
import { ChevronsUpDown, Loader2, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  fetchSegments,
  fetchSegmentsByIds,
} from "@/features/segments/segments-api"
import type { Segment } from "@/features/segments/segments-types"

function parseSegmentIds(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

function mergeSegments(...collections: Array<Segment[] | undefined>) {
  const segments = new Map<string, Segment>()
  collections.forEach((collection) =>
    collection?.forEach((segment) => segments.set(segment.id, segment))
  )
  return [...segments.values()]
}

export function SegmentConditionPicker({
  envId,
  value,
  disabled,
  onValueChange,
}: {
  envId: string
  value: string
  disabled: boolean
  onValueChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const selectedIds = useMemo(() => parseSegmentIds(value), [value])

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300
    )
    return () => window.clearTimeout(timeout)
  }, [search])

  const selectedQuery = useQuery({
    queryKey: ["targeting-segments-by-id", envId, selectedIds],
    queryFn: () => fetchSegmentsByIds(envId, selectedIds),
    enabled: Boolean(envId && selectedIds.length),
    staleTime: 60_000,
  })
  const searchQuery = useQuery({
    queryKey: ["targeting-segments", envId, debouncedSearch],
    queryFn: () =>
      fetchSegments(envId, {
        name: debouncedSearch,
        isArchived: false,
        pageIndex: 0,
        pageSize: 20,
      }),
    enabled: Boolean(envId && open),
    staleTime: 30_000,
  })

  const options = mergeSegments(searchQuery.data?.items, selectedQuery.data)
  const labels = new Map(options.map((segment) => [segment.id, segment.name]))
  const selectedLabels = selectedIds.map((id) => labels.get(id) ?? id)

  function toggleSegment(segmentId: string) {
    const next = selectedIds.includes(segmentId)
      ? selectedIds.filter((id) => id !== segmentId)
      : [...selectedIds, segmentId]
    onValueChange(JSON.stringify(next))
  }

  return (
    <div
      data-testid="segment-condition-picker"
      className="flex min-h-8 min-w-0 flex-wrap items-center gap-1 rounded-lg border border-input bg-background px-2 py-0.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
    >
      {selectedLabels.map((label, index) => (
        <Badge
          key={selectedIds[index]}
          variant="secondary"
          className="max-w-full gap-1 rounded-md pr-1 pl-2 font-normal"
        >
          <span className="truncate">{label}</span>
          <button
            type="button"
            disabled={disabled}
            aria-label={t("targeting.rules.removeValue", { value: label })}
            className="shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() =>
              onValueChange(
                JSON.stringify(
                  selectedIds.filter(
                    (segmentId) => segmentId !== selectedIds[index]
                  )
                )
              )
            }
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setSearch("")
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              role="combobox"
              variant="ghost"
              disabled={disabled}
              aria-label={t("targeting.rules.segments.select")}
              aria-expanded={open}
              className="h-6 min-w-8 flex-1 justify-end px-1 font-normal text-muted-foreground hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent dark:aria-expanded:bg-transparent"
            />
          }
        >
          {!selectedLabels.length ? (
            <span className="mr-auto truncate">
              {t("targeting.rules.segments.select")}
            </span>
          ) : null}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--anchor-width)] min-w-72 p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              autoFocus
              placeholder={t("targeting.rules.segments.search")}
              onValueChange={setSearch}
            />
            <CommandList>
              {searchQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("targeting.loading")}
                </div>
              ) : searchQuery.isError ? (
                <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm text-destructive">
                  <span>{t("targeting.rules.segments.loadFailed")}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void searchQuery.refetch()}
                  >
                    {t("targeting.retry")}
                  </Button>
                </div>
              ) : null}
              {!searchQuery.isLoading && !searchQuery.isError ? (
                <CommandEmpty>
                  {t("targeting.rules.segments.empty")}
                </CommandEmpty>
              ) : null}
              {options.length ? (
                <CommandGroup>
                  {options.map((segment) => (
                    <CommandItem
                      key={segment.id}
                      value={`${segment.name} ${segment.key}`}
                      data-checked={selectedIds.includes(segment.id)}
                      onSelect={() => toggleSegment(segment.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{segment.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {segment.key}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
