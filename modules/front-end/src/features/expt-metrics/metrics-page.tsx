import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, Loader2, MousePointerClick, Plus, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import { MetricSheet } from "./components/metric-sheet"
import { MetricsPagination } from "./components/metrics-pagination"
import { MetricsTable } from "./components/metrics-table"
import {
  archiveMetric,
  createMetric,
  fetchMetrics,
  restoreMetric,
  updateMetric,
} from "./metrics-api"
import type {
  Metric,
  MetricCreatePayload,
  MetricUpdatePayload,
} from "./metrics-types"

export function MetricsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const envId = getCurrentProjectEnv()?.envId ?? ""
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [archived, setArchived] = useState(false)
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sheetMetric, setSheetMetric] = useState<Metric | null | undefined>()
  const [archiveTarget, setArchiveTarget] = useState<Metric | null>(null)
  const [archiveConfirmationKey, setArchiveConfirmationKey] = useState("")

  useEffect(() => {
    if (search.trim() === debouncedSearch) return

    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPageIndex(1)
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [search, debouncedSearch])

  const listQuery = useQuery({
    queryKey: [
      "experiment-metrics",
      envId,
      debouncedSearch,
      archived,
      pageIndex,
      pageSize,
    ],
    queryFn: () =>
      fetchMetrics(envId, {
        search: debouncedSearch,
        status: archived ? "archived" : "active",
        pageIndex: pageIndex - 1,
        pageSize,
      }),
    enabled: Boolean(envId),
    placeholderData: (previous) => previous,
  })

  const saveMutation = useMutation({
    mutationFn: ({
      metric,
      payload,
    }: {
      metric: Metric | null
      payload: MetricCreatePayload | MetricUpdatePayload
    }) =>
      metric
        ? updateMetric(envId, metric.id, payload as MetricUpdatePayload)
        : createMetric(envId, payload as MetricCreatePayload),
    onSuccess: (_, variables) => {
      setSheetMetric(undefined)
      toast.success(
        t(
          variables.metric
            ? "releaseDecision.metrics.updateSucceeded"
            : "releaseDecision.metrics.createSucceeded"
        )
      )
      void queryClient.invalidateQueries({ queryKey: ["experiment-metrics"] })
    },
    onError: (_, variables) => {
      toast.error(
        t(
          variables.metric
            ? "releaseDecision.metrics.updateFailed"
            : "releaseDecision.metrics.createFailed"
        )
      )
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (metric: Metric) => archiveMetric(envId, metric.id),
    onSuccess: () => {
      setArchiveTarget(null)
      toast.success(t("releaseDecision.metrics.archiveSucceeded"))
      if ((listQuery.data?.items.length ?? 0) === 1 && pageIndex > 1) {
        setPageIndex((current) => current - 1)
      }
      void queryClient.invalidateQueries({ queryKey: ["experiment-metrics"] })
    },
    onError: () => toast.error(t("releaseDecision.metrics.archiveFailed")),
  })

  const restoreMutation = useMutation({
    mutationFn: (metric: Metric) => restoreMetric(envId, metric.id),
    onSuccess: () => {
      toast.success(t("releaseDecision.metrics.restoreSucceeded"))
      if ((listQuery.data?.items.length ?? 0) === 1 && pageIndex > 1) {
        setPageIndex((current) => current - 1)
      }
      void queryClient.invalidateQueries({ queryKey: ["experiment-metrics"] })
    },
    onError: () => toast.error(t("releaseDecision.metrics.restoreFailed")),
  })

  const data = listQuery.data ?? { items: [], totalCount: 0 }
  const mutatingId = archiveMutation.isPending
    ? (archiveMutation.variables?.id ?? null)
    : restoreMutation.isPending
      ? (restoreMutation.variables?.id ?? null)
      : null

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
        <header className="mb-10 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("releaseDecision.metrics.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("releaseDecision.metrics.subtitle")}
          </p>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-80 max-w-full">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                className="pl-9"
                placeholder={t("releaseDecision.metrics.search")}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              aria-pressed={archived}
              className={archived ? "bg-accent text-accent-foreground" : ""}
              onClick={() => {
                setArchived((current) => !current)
                setPageIndex(1)
              }}
            >
              <Archive />
              {t("releaseDecision.metrics.showArchived")}
            </Button>
          </div>

          <Button type="button" onClick={() => setSheetMetric(null)}>
            <Plus />
            {t("releaseDecision.metrics.new")}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border bg-background">
          {!envId || listQuery.isError ? (
            <div className="flex items-center justify-between border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
              <span>{t("releaseDecision.metrics.loadFailed")}</span>
              {envId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void listQuery.refetch()}
                >
                  {t("releaseDecision.metrics.retry")}
                </Button>
              ) : null}
            </div>
          ) : null}
          <MetricsTable
            items={data.items}
            loading={listQuery.isLoading}
            archived={archived}
            query={debouncedSearch}
            mutatingId={mutatingId}
            onCopy={async (key) => {
              try {
                await navigator.clipboard.writeText(key)
                toast.success(t("releaseDecision.metrics.copied"))
              } catch {
                toast.error(t("releaseDecision.metrics.copyFailed"))
              }
            }}
            onEdit={setSheetMetric}
            onArchive={(metric) => {
              setArchiveConfirmationKey("")
              setArchiveTarget(metric)
            }}
            onRestore={(metric) => restoreMutation.mutate(metric)}
            onClearSearch={() => setSearch("")}
            onCreate={() => setSheetMetric(null)}
          />
        </div>

        <MetricsPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={data.totalCount}
          disabled={listQuery.isFetching}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />

        {sheetMetric !== undefined ? (
          <MetricSheet
            metric={sheetMetric}
            saving={saveMutation.isPending}
            onOpenChange={(open) => {
              if (!open) setSheetMetric(undefined)
            }}
            onSubmit={(payload) =>
              saveMutation
                .mutateAsync({ metric: sheetMetric, payload })
                .then(() => undefined)
            }
          />
        ) : null}

        <AlertDialog
          open={Boolean(archiveTarget)}
          onOpenChange={(open) => {
            if (!open && !archiveMutation.isPending) {
              setArchiveTarget(null)
              setArchiveConfirmationKey("")
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("releaseDecision.metrics.archiveTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {archiveTarget ? (
                  <>
                    {t("releaseDecision.metrics.archiveDescriptionBefore")}
                    <strong className="font-semibold text-foreground">
                      {archiveTarget.name}
                    </strong>
                    {t("releaseDecision.metrics.archiveDescriptionAfter")}
                  </>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {archiveTarget ? (
              <div className="space-y-2">
                <p
                  id="metric-archive-key-prompt"
                  className="flex flex-wrap items-center gap-1.5 text-sm font-medium"
                >
                  <span>
                    {t("releaseDecision.metrics.archiveKeyPromptBefore")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 border-primary/40 bg-primary/5 px-1.5 font-mono text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                    disabled={archiveMutation.isPending}
                    aria-label={t("releaseDecision.metrics.useArchiveKey", {
                      key: archiveTarget.key,
                    })}
                    onClick={() => setArchiveConfirmationKey(archiveTarget.key)}
                  >
                    <MousePointerClick className="size-3" />
                    {archiveTarget.key}
                  </Button>
                  <span>
                    {t("releaseDecision.metrics.archiveKeyPromptAfter")}
                  </span>
                </p>
                <Input
                  id="metric-archive-key"
                  aria-labelledby="metric-archive-key-prompt"
                  value={archiveConfirmationKey}
                  placeholder={t(
                    "releaseDecision.metrics.archiveKeyPlaceholder"
                  )}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={archiveMutation.isPending}
                  onChange={(event) =>
                    setArchiveConfirmationKey(event.target.value)
                  }
                />
              </div>
            ) : null}
            <AlertDialogFooter className="border-t-0 bg-transparent">
              <AlertDialogCancel disabled={archiveMutation.isPending}>
                {t("releaseDecision.metrics.form.cancel")}
              </AlertDialogCancel>
              <Button
                type="button"
                disabled={
                  archiveMutation.isPending ||
                  archiveConfirmationKey !== archiveTarget?.key
                }
                onClick={() => {
                  if (archiveTarget) archiveMutation.mutate(archiveTarget)
                }}
              >
                {archiveMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {t("releaseDecision.metrics.archive")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
