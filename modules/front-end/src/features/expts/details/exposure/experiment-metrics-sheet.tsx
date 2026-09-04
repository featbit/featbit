import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { StablePopoverContent } from "@/components/stable-popover-content"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Label } from "@/components/ui/label"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchMetrics } from "@/features/expt-metrics/metrics-api"
import type { Metric } from "@/features/expt-metrics/metrics-types"
import { cn } from "@/lib/utils"
import type { ExperimentMetricsUpdate } from "../experiment-details-types"
import type {
  GuardrailDirection,
  MetricDirection,
  SelectedMetric,
} from "./exposure-utils"

type GuardrailRow = {
  id: string
  metricKey: string
  direction: GuardrailDirection
}

type MetricOption = Pick<Metric, "id" | "key" | "name">

const METRICS_PAGE_SIZE = 10

function selectedMetricOptions(
  primary: SelectedMetric | null,
  guardrails: SelectedMetric[]
) {
  const options: Record<string, MetricOption> = {}
  for (const metric of [primary, ...guardrails]) {
    if (metric?.id) {
      options[metric.key] = {
        id: metric.id,
        key: metric.key,
        name: metric.name,
      }
    }
  }
  return options
}

function guardrailsFromSelection(guardrails: SelectedMetric[]) {
  return guardrails.map<GuardrailRow>((metric, index) => ({
    id: `${metric.key}-${index}`,
    metricKey: metric.key,
    direction:
      metric.direction === "decrease_bad" ? "decrease_bad" : "increase_bad",
  }))
}

function metricLabel(metric: MetricOption) {
  return `${metric.name} (${metric.key})`
}

function MetricPicker({
  envId,
  portalContainer,
  value,
  selectedOption,
  selectedKeys,
  onSelect,
}: {
  envId: string
  portalContainer: RefObject<HTMLDivElement | null>
  value: string
  selectedOption?: MetricOption
  selectedKeys: ReadonlySet<string>
  onSelect: (metric: Metric) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      350
    )
    return () => window.clearTimeout(timeout)
  }, [search])

  const optionsQuery = useQuery({
    queryKey: ["experiment-metric-options", envId, debouncedSearch],
    queryFn: () =>
      fetchMetrics(envId, {
        search: debouncedSearch,
        status: "active",
        pageIndex: 0,
        pageSize: METRICS_PAGE_SIZE,
      }),
    enabled: open && Boolean(envId),
    staleTime: 30_000,
  })
  const options = optionsQuery.data?.items ?? []

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setSearch("")
          setDebouncedSearch("")
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between px-3 font-normal"
          />
        }
      >
        <span
          className={cn(
            "min-w-0 truncate text-left",
            !selectedOption && "text-muted-foreground"
          )}
        >
          {selectedOption
            ? metricLabel(selectedOption)
            : t(
                "releaseDecision.experiments.detailsPage.exposure.metricsSheet.selectMetric"
              )}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <StablePopoverContent
        portalContainer={portalContainer}
        align="start"
        className="w-[var(--anchor-width)] min-w-72 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t(
              "releaseDecision.experiments.detailsPage.exposure.metricsSheet.search"
            )}
          />
          <CommandList>
            {optionsQuery.isFetching ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : null}
            {optionsQuery.isError ? (
              <div className="py-6 text-center text-sm text-destructive">
                {t(
                  "releaseDecision.experiments.detailsPage.exposure.metricsSheet.loadFailed"
                )}
              </div>
            ) : null}
            {!optionsQuery.isFetching && !optionsQuery.isError ? (
              <CommandEmpty>
                {t(
                  `releaseDecision.experiments.detailsPage.exposure.metricsSheet.${debouncedSearch ? "filteredEmpty" : "empty"}`
                )}
              </CommandEmpty>
            ) : null}
            <CommandGroup>
              {options.map((metric) => (
                <CommandItem
                  key={metric.id}
                  value={metric.key}
                  disabled={
                    metric.key !== value && selectedKeys.has(metric.key)
                  }
                  onSelect={() => {
                    onSelect(metric)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono">
                      {metric.key}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {metric.name}
                    </span>
                  </span>
                  <Check
                    className={cn(
                      "size-4 text-primary",
                      value === metric.key ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </StablePopoverContent>
    </Popover>
  )
}

export function ExperimentMetricsSheet({
  open,
  envId,
  primary,
  guardrails,
  saving,
  saveError,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  envId: string
  primary: SelectedMetric | null
  guardrails: SelectedMetric[]
  saving: boolean
  saveError: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (update: ExperimentMetricsUpdate) => Promise<void>
}) {
  const { t } = useTranslation()
  const [primaryKey, setPrimaryKey] = useState(primary?.key ?? "")
  const [primaryDirection, setPrimaryDirection] = useState<MetricDirection>(
    primary?.direction === "decrease_good" ? "decrease_good" : "increase_good"
  )
  const [guardrailRows, setGuardrailRows] = useState<GuardrailRow[]>(() =>
    guardrailsFromSelection(guardrails)
  )
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, MetricOption>
  >(() => selectedMetricOptions(primary, guardrails))
  const [dirty, setDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const popoverPortalRef = useRef<HTMLDivElement>(null)

  const metricsQuery = useQuery({
    queryKey: ["experiment-metric-options", envId, ""],
    queryFn: () =>
      fetchMetrics(envId, {
        search: "",
        status: "active",
        pageIndex: 0,
        pageSize: METRICS_PAGE_SIZE,
      }),
    enabled: open && Boolean(envId),
    staleTime: 30_000,
  })
  const metrics = metricsQuery.data?.items ?? []
  const selectedPrimary =
    metrics.find((metric) => metric.key === primaryKey) ??
    selectedOptions[primaryKey]
  const selectedKeys = useMemo(
    () =>
      new Set(
        [primaryKey, ...guardrailRows.map((row) => row.metricKey)].filter(
          Boolean
        )
      ),
    [guardrailRows, primaryKey]
  )
  const selectedGuardrails = guardrailRows.map((row) => ({
    row,
    metric:
      metrics.find((metric) => metric.key === row.metricKey) ??
      selectedOptions[row.metricKey],
  }))

  function rememberMetric(metric: Metric) {
    setSelectedOptions((options) => ({
      ...options,
      [metric.key]: metric,
    }))
  }

  function requestClose() {
    if (saving) return
    if (dirty) setDiscardOpen(true)
    else onOpenChange(false)
  }

  function updateGuardrail(
    id: string,
    update: Partial<Pick<GuardrailRow, "metricKey" | "direction">>
  ) {
    setGuardrailRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...update } : row))
    )
    setDirty(true)
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose()
        }}
      >
        <SheetContent
          ref={popoverPortalRef}
          className="gap-0 p-0 data-[side=right]:w-[min(100vw,500px)] data-[side=right]:sm:max-w-[500px]"
          showCloseButton={!saving}
        >
          <SheetHeader className="border-b px-6 py-5 pr-12">
            <SheetTitle className="text-lg font-semibold">
              {t(
                "releaseDecision.experiments.detailsPage.exposure.metricsSheet.title"
              )}
            </SheetTitle>
            <SheetDescription className="mt-1.5 leading-5">
              {t(
                "releaseDecision.experiments.detailsPage.exposure.metricsSheet.subtitle"
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
            {metricsQuery.isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
            ) : metricsQuery.isError ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">
                  {t(
                    "releaseDecision.experiments.detailsPage.exposure.metricsSheet.loadFailed"
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void metricsQuery.refetch()}
                >
                  {t("releaseDecision.experiments.retry")}
                </Button>
              </div>
            ) : metrics.length === 0 && !primaryKey ? (
              <div className="rounded-lg border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                {t(
                  "releaseDecision.experiments.detailsPage.exposure.metricsSheet.empty"
                )}
              </div>
            ) : (
              <>
                <section className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {t(
                          "releaseDecision.experiments.detailsPage.exposure.metricsSheet.primary"
                        )}
                      </h3>
                      <Badge
                        variant="outline"
                        className="border-violet-200 bg-violet-50 font-normal text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
                      >
                        {t(
                          "releaseDecision.experiments.detailsPage.exposure.metricsSheet.required"
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm leading-5 text-muted-foreground">
                      {t(
                        "releaseDecision.experiments.detailsPage.exposure.metricsSheet.primaryHelp"
                      )}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {t(
                        "releaseDecision.experiments.detailsPage.exposure.metricsSheet.metric"
                      )}
                    </Label>
                    <MetricPicker
                      envId={envId}
                      portalContainer={popoverPortalRef}
                      value={primaryKey}
                      selectedOption={selectedPrimary}
                      selectedKeys={selectedKeys}
                      onSelect={(metric) => {
                        rememberMetric(metric)
                        setPrimaryKey(metric.key)
                        setDirty(true)
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {t(
                        "releaseDecision.experiments.detailsPage.exposure.metricsSheet.direction"
                      )}
                    </Label>
                    <Select
                      value={primaryDirection}
                      onValueChange={(value) => {
                        setPrimaryDirection(value as MetricDirection)
                        setDirty(true)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {t(
                            `releaseDecision.experiments.detailsPage.exposure.${primaryDirection === "decrease_good" ? "lowerIsBetter" : "higherIsBetter"}`
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="increase_good">
                            {t(
                              "releaseDecision.experiments.detailsPage.exposure.higherIsBetter"
                            )}
                          </SelectItem>
                          <SelectItem value="decrease_good">
                            {t(
                              "releaseDecision.experiments.detailsPage.exposure.lowerIsBetter"
                            )}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {t(
                          "releaseDecision.experiments.detailsPage.exposure.metricsSheet.guardrails"
                        )}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {t(
                          "releaseDecision.experiments.detailsPage.exposure.metricsSheet.optional"
                        )}
                      </span>
                    </div>
                    <p className="text-sm leading-5 text-muted-foreground">
                      {t(
                        "releaseDecision.experiments.detailsPage.exposure.metricsSheet.guardrailHelp"
                      )}
                    </p>
                  </div>

                  {guardrailRows.length ? (
                    <div className="space-y-3">
                      {guardrailRows.map((row) => {
                        const activeMetric =
                          metrics.find(
                            (metric) => metric.key === row.metricKey
                          ) ?? selectedOptions[row.metricKey]
                        return (
                          <div
                            key={row.id}
                            className="space-y-3 rounded-lg border p-3"
                          >
                            <div className="space-y-2">
                              <Label>
                                {t(
                                  "releaseDecision.experiments.detailsPage.exposure.metricsSheet.metric"
                                )}
                              </Label>
                              <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <MetricPicker
                                    envId={envId}
                                    portalContainer={popoverPortalRef}
                                    value={row.metricKey}
                                    selectedOption={activeMetric}
                                    selectedKeys={selectedKeys}
                                    onSelect={(metric) => {
                                      rememberMetric(metric)
                                      updateGuardrail(row.id, {
                                        metricKey: metric.key,
                                      })
                                    }}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 shrink-0"
                                  aria-label={t(
                                    "releaseDecision.experiments.detailsPage.exposure.metricsSheet.removeGuardrail"
                                  )}
                                  onClick={() => {
                                    setGuardrailRows((rows) =>
                                      rows.filter((item) => item.id !== row.id)
                                    )
                                    setDirty(true)
                                  }}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>
                                {t(
                                  "releaseDecision.experiments.detailsPage.exposure.metricsSheet.alertIf"
                                )}
                              </Label>
                              <Select
                                value={row.direction}
                                onValueChange={(value) =>
                                  updateGuardrail(row.id, {
                                    direction: value as GuardrailDirection,
                                  })
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue>
                                    {t(
                                      `releaseDecision.experiments.detailsPage.exposure.metricsSheet.${row.direction === "decrease_bad" ? "decreases" : "increases"}`
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="increase_bad">
                                      {t(
                                        "releaseDecision.experiments.detailsPage.exposure.metricsSheet.increases"
                                      )}
                                    </SelectItem>
                                    <SelectItem value="decrease_bad">
                                      {t(
                                        "releaseDecision.experiments.detailsPage.exposure.metricsSheet.decreases"
                                      )}
                                    </SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border px-4 py-5 text-sm text-muted-foreground">
                      {t(
                        "releaseDecision.experiments.detailsPage.exposure.metricsSheet.noGuardrails"
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={
                      (metricsQuery.data?.totalCount ?? 0) <= selectedKeys.size
                    }
                    onClick={() => {
                      setGuardrailRows((rows) => [
                        ...rows,
                        {
                          id: crypto.randomUUID(),
                          metricKey: "",
                          direction: "increase_bad",
                        },
                      ])
                      setDirty(true)
                    }}
                  >
                    <Plus />
                    {t(
                      "releaseDecision.experiments.detailsPage.exposure.metricsSheet.addGuardrail"
                    )}
                  </Button>
                </section>
              </>
            )}
          </div>

          <SheetFooter className="flex-row items-center justify-between px-6 py-5">
            {saveError ? (
              <p className="text-sm text-destructive">
                {t(
                  "releaseDecision.experiments.detailsPage.exposure.metricsSheet.saveFailed"
                )}
              </p>
            ) : (
              <span />
            )}
            <Button
              type="button"
              disabled={
                !selectedPrimary ||
                selectedGuardrails.some(({ row, metric }) =>
                  Boolean(!row.metricKey || !metric)
                ) ||
                saving
              }
              onClick={() => {
                if (!selectedPrimary) return
                void onConfirm({
                  metricId: selectedPrimary.id,
                  metricKey: selectedPrimary.key,
                  expectedDirection: primaryDirection,
                  guardrails: JSON.stringify(
                    selectedGuardrails
                      .map(({ row, metric }) => {
                        if (!metric) return null
                        return {
                          metricId: metric.id,
                          metricKey: metric.key,
                          direction: row.direction,
                        }
                      })
                      .filter(Boolean)
                  ),
                })
              }}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {t(
                `releaseDecision.experiments.detailsPage.exposure.metricsSheet.${saving ? "saving" : "save"}`
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                "releaseDecision.experiments.detailsPage.exposure.metricsSheet.discardTitle"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "releaseDecision.experiments.detailsPage.exposure.metricsSheet.discardDescription"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardOpen(false)}
            >
              {t(
                "releaseDecision.experiments.detailsPage.exposure.metricsSheet.keepEditing"
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                onOpenChange(false)
              }}
            >
              {t(
                "releaseDecision.experiments.detailsPage.exposure.metricsSheet.discard"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
