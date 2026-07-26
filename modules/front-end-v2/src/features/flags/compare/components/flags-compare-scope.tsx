import {
  AlertTriangle,
  ArrowRight,
  Box,
  ChevronDown,
  Loader2,
  Lock,
  X,
} from "lucide-react"
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react"
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
import type { Lang, ProjectEnv } from "@/features/layout/layout-types"
import type { CompareEnvironment } from "../flags-compare-types"

function EnvironmentChip({
  environment,
  disabled,
  removeLabel,
  onRemove,
}: {
  environment: CompareEnvironment
  disabled: boolean
  removeLabel: string
  onRemove: () => void
}) {
  return (
    <span
      data-environment-chip
      className="inline-flex h-6 max-w-56 min-w-0 items-center gap-1 rounded-md bg-muted px-2 text-xs text-foreground"
      title={environment.label}
    >
      <Box className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{environment.label}</span>
      <button
        type="button"
        className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
        aria-label={`${removeLabel} ${environment.label}`}
        onClick={onRemove}
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

function HiddenEnvironmentPopover({
  environments,
  disabled,
  lang,
  onRemove,
}: {
  environments: CompareEnvironment[]
  disabled: boolean
  lang: Lang
  onRemove: (id: string) => void
}) {
  const zh = lang === "zh"
  if (!environments.length) return null

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="xs"
            variant="secondary"
            disabled={disabled}
            aria-label={
              zh
                ? `显示另外 ${environments.length} 个已选环境`
                : `Show ${environments.length} more selected environments`
            }
            className="h-6 px-2"
          />
        }
      >
        +{environments.length}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-xs font-medium">
          {zh
            ? `另外 ${environments.length} 个已选环境`
            : `${environments.length} more selected`}
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {environments.map((environment) => (
            <div
              key={environment.id}
              className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-muted/60"
            >
              <Box className="size-4 shrink-0 text-muted-foreground" />
              <span
                className="min-w-0 flex-1 truncate"
                title={environment.label}
              >
                {environment.label}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={`${zh ? "移除" : "Remove"} ${environment.label}`}
                onClick={() => onRemove(environment.id)}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TargetEnvironmentPicker({
  environments,
  selectedIds,
  loading,
  error,
  disabled,
  lang,
  onChange,
  onRetry,
}: {
  environments: CompareEnvironment[]
  selectedIds: string[]
  loading: boolean
  error: boolean
  disabled: boolean
  lang: Lang
  onChange: (ids: string[]) => void
  onRetry: () => void
}) {
  const zh = lang === "zh"
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const selectedViewportRef = useRef<HTMLDivElement>(null)
  const measurementRowRef = useRef<HTMLDivElement>(null)
  const [measuredLayout, setMeasuredLayout] = useState({
    signature: "",
    visibleCount: 0,
  })
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selected = useMemo(
    () =>
      environments.filter((environment) => selectedIdSet.has(environment.id)),
    [environments, selectedIdSet]
  )
  const selectedSignature = selected
    .map((environment) => environment.id)
    .join(",")
  const visibleSelectedCount =
    measuredLayout.signature === selectedSignature
      ? Math.min(measuredLayout.visibleCount, selected.length)
      : selected.length
  const visibleSelected = selected.slice(0, visibleSelectedCount)
  const hiddenSelected = selected.slice(visibleSelectedCount)
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const visible = environments.filter(
    (environment) =>
      !normalizedSearch ||
      environment.label.toLocaleLowerCase().includes(normalizedSearch)
  )
  const projectGroups = visible.reduce<
    Array<{ id: string; name: string; environments: CompareEnvironment[] }>
  >((groups, environment) => {
    const existing = groups.find((group) => group.id === environment.projectId)
    if (existing) existing.environments.push(environment)
    else
      groups.push({
        id: environment.projectId,
        name: environment.projectName,
        environments: [environment],
      })
    return groups
  }, [])

  function toggle(id: string) {
    onChange(
      selectedIdSet.has(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id]
    )
  }

  function remove(id: string) {
    onChange(selectedIds.filter((item) => item !== id))
  }

  function openFromField(event: MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (
      disabled ||
      !(target instanceof Element) ||
      !event.currentTarget.contains(target) ||
      target.closest("button")
    )
      return
    setOpen(true)
  }

  const removeLabel = zh ? "移除" : "Remove"

  useEffect(() => {
    const viewport = selectedViewportRef.current
    const measurementRow = measurementRowRef.current
    if (!viewport || !measurementRow || !selected.length) return

    function updateVisibleCount() {
      if (!viewport || !measurementRow) return

      const availableWidth = viewport.clientWidth
      const chipWidths = Array.from(
        measurementRow.querySelectorAll<HTMLElement>("[data-environment-chip]")
      ).map((chip) => chip.getBoundingClientRect().width)
      const overflowWidths = new Map(
        Array.from(
          measurementRow.querySelectorAll<HTMLElement>("[data-overflow-count]")
        ).map((chip) => [
          Number(chip.dataset.overflowCount),
          chip.getBoundingClientRect().width,
        ])
      )
      const gap =
        Number.parseFloat(getComputedStyle(measurementRow).columnGap) || 0
      const prefixWidths = chipWidths.reduce<number[]>(
        (widths, width, index) => [
          ...widths,
          widths[index] + width + (index ? gap : 0),
        ],
        [0]
      )
      let nextVisibleCount = 0

      for (let count = selected.length; count >= 0; count -= 1) {
        const hiddenCount = selected.length - count
        const requiredWidth =
          prefixWidths[count] +
          (hiddenCount
            ? (count ? gap : 0) + (overflowWidths.get(hiddenCount) ?? 0)
            : 0)
        if (requiredWidth <= availableWidth) {
          nextVisibleCount = count
          break
        }
      }

      setMeasuredLayout((current) =>
        current.signature === selectedSignature &&
        current.visibleCount === nextVisibleCount
          ? current
          : { signature: selectedSignature, visibleCount: nextVisibleCount }
      )
    }

    const observer = new ResizeObserver(updateVisibleCount)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [selected, selectedSignature])

  return (
    <div
      data-slot="target-environment-picker"
      className={`flex h-9 min-w-0 items-center gap-2 rounded-md border bg-background px-3 py-1 focus-within:ring-2 focus-within:ring-ring/30 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      onClick={openFromField}
    >
      {selected.length ? (
        <div
          ref={selectedViewportRef}
          className="relative min-w-0 flex-1 overflow-hidden"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {visibleSelected.map((environment) => (
              <EnvironmentChip
                key={environment.id}
                environment={environment}
                disabled={disabled}
                removeLabel={removeLabel}
                onRemove={() => remove(environment.id)}
              />
            ))}
            <HiddenEnvironmentPopover
              environments={hiddenSelected}
              disabled={disabled}
              lang={lang}
              onRemove={remove}
            />
          </div>
          <div
            ref={measurementRowRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute top-0 left-0 flex items-center gap-1.5 whitespace-nowrap"
          >
            {selected.map((environment) => (
              <EnvironmentChip
                key={environment.id}
                environment={environment}
                disabled
                removeLabel={removeLabel}
                onRemove={() => undefined}
              />
            ))}
            {selected.map((_, index) => {
              const overflowCount = selected.length - index
              return (
                <Button
                  key={overflowCount}
                  type="button"
                  size="xs"
                  variant="secondary"
                  tabIndex={-1}
                  data-overflow-count={overflowCount}
                  className="h-6 px-2"
                >
                  +{overflowCount}
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setSearch("")
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              className={
                selected.length
                  ? "ml-auto size-7 shrink-0 px-0"
                  : "h-7 min-w-0 flex-1 justify-between px-1 font-normal text-muted-foreground"
              }
              aria-label={
                zh ? "选择要比较的目标环境" : "Select target environments"
              }
            />
          }
        >
          {!selected.length ? (
            <span className="truncate">
              {zh
                ? "选择一个或多个环境进行比较"
                : "Select one or more environments to compare"}
            </span>
          ) : null}
          <ChevronDown className="size-4 shrink-0" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(440px,calc(100vw-3rem))] p-0"
        >
          <div className="flex h-10 items-center justify-between border-b px-3 text-xs">
            <span className="font-medium">
              {zh
                ? `已选择 ${selected.length} 个`
                : `${selected.length} selected`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!selected.length || disabled}
              onClick={() => onChange([])}
            >
              {zh ? "全部清除" : "Clear all"}
            </Button>
          </div>
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              placeholder={
                zh ? "搜索项目或环境" : "Search projects or environments"
              }
              onValueChange={setSearch}
            />
            <CommandList className="max-h-80">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {zh ? "正在加载环境…" : "Loading environments…"}
                </div>
              ) : null}
              {error ? (
                <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm text-destructive">
                  <span>
                    {zh
                      ? "无法加载环境。"
                      : "Environments could not be loaded."}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                  >
                    {zh ? "重试" : "Retry"}
                  </Button>
                </div>
              ) : null}
              {!loading && !error ? (
                <CommandEmpty>
                  {zh ? "未找到环境" : "No environments found"}
                </CommandEmpty>
              ) : null}
              {!loading && !error
                ? projectGroups.map((group) => (
                    <CommandGroup key={group.id} heading={group.name}>
                      {group.environments.map((environment) => (
                        <CommandItem
                          key={environment.id}
                          value={environment.label}
                          data-checked={selectedIdSet.has(environment.id)}
                          onSelect={() => toggle(environment.id)}
                        >
                          <Box className="size-4 text-muted-foreground" />
                          <span className="truncate">{environment.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))
                : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function FlagsCompareScope({
  lang,
  source,
  environments,
  selectedIds,
  loading,
  error,
  disabled,
  applying,
  hasUnappliedChanges,
  onChange,
  onApply,
  onRetry,
}: {
  lang: Lang
  source: ProjectEnv | null
  environments: CompareEnvironment[]
  selectedIds: string[]
  loading: boolean
  error: boolean
  disabled: boolean
  applying: boolean
  hasUnappliedChanges: boolean
  onChange: (ids: string[]) => void
  onApply: () => void
  onRetry: () => void
}) {
  const zh = lang === "zh"

  return (
    <section className="grid gap-4 rounded-md border bg-background p-4 lg:grid-cols-[minmax(240px,0.85fr)_auto_minmax(340px,1.4fr)_auto] lg:items-end lg:gap-y-2">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <p className="mb-1.5 text-sm font-medium">
          {zh ? "源环境" : "Source environment"}
        </p>
        <div className="flex h-9 min-w-0 items-center gap-2 rounded-md border bg-muted/40 px-3">
          <Box className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">
            {source ? `${source.projectName} / ${source.envName}` : "-"}
          </span>
          <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <ArrowRight className="mb-2.5 hidden size-5 text-muted-foreground lg:col-start-2 lg:row-start-1 lg:block" />

      <div className="min-w-0 lg:contents">
        <div className="min-w-0 lg:col-start-3 lg:row-start-1">
          <p className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <ArrowRight className="size-4 text-muted-foreground lg:hidden" />
            {zh ? "目标环境" : "Target environments"}
          </p>
          <TargetEnvironmentPicker
            environments={environments}
            selectedIds={selectedIds}
            loading={loading}
            error={error}
            disabled={disabled || applying}
            lang={lang}
            onChange={onChange}
            onRetry={onRetry}
          />
        </div>
        {hasUnappliedChanges ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 lg:col-start-3 lg:row-start-2 lg:mt-0 dark:text-amber-300">
            <AlertTriangle className="size-3.5 shrink-0" />
            {zh
              ? "选择已更改。应用后刷新比较结果。"
              : "Selection changed. Apply to refresh comparison."}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        className="w-full lg:col-start-4 lg:row-start-1 lg:mb-0 lg:w-24"
        disabled={disabled || applying || !selectedIds.length}
        onClick={onApply}
      >
        {applying ? <Loader2 className="animate-spin" /> : null}
        {applying ? (zh ? "应用中" : "Applying") : zh ? "应用" : "Apply"}
      </Button>
    </section>
  )
}
