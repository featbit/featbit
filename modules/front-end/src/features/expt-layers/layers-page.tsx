import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, Loader2, MousePointerClick, Plus, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
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
import {
  getCurrentProjectEnv,
  resolveLang,
} from "@/features/layout/layout-context"
import {
  archiveLayer,
  createLayer,
  fetchLayers,
  restoreLayer,
  updateLayer,
} from "./layers-api"
import type { Layer, LayerPayload } from "./layers-types"
import { LayerSheet } from "./components/layer-sheet"
import { LayersPagination } from "./components/layers-pagination"
import { LayersTable } from "./components/layers-table"

export function LayersPage() {
  const { t } = useTranslation()
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const queryClient = useQueryClient()
  const envId = getCurrentProjectEnv()?.envId ?? ""
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [archived, setArchived] = useState(false)
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sheetLayer, setSheetLayer] = useState<Layer | null | undefined>()
  const [archiveTarget, setArchiveTarget] = useState<Layer | null>(null)
  const [archiveConfirmationKey, setArchiveConfirmationKey] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPageIndex(1)
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [search])

  const listQuery = useQuery({
    queryKey: ["layers", envId, debouncedSearch, archived, pageIndex, pageSize],
    queryFn: () =>
      fetchLayers(envId, {
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
      layer,
      payload,
    }: {
      layer: Layer | null
      payload: LayerPayload
    }) =>
      layer
        ? updateLayer(envId, layer.id, {
            name: payload.name,
            description: payload.description,
            assignmentUnitSelector: payload.assignmentUnitSelector,
          })
        : createLayer(envId, payload),
    onSuccess: (_, variables) => {
      setSheetLayer(undefined)
      toast.success(
        t(
          variables.layer
            ? "releaseDecision.layers.updateSucceeded"
            : "releaseDecision.layers.createSucceeded"
        )
      )
      void queryClient.invalidateQueries({ queryKey: ["layers"] })
    },
    onError: (_, variables) => {
      toast.error(
        t(
          variables.layer
            ? "releaseDecision.layers.updateFailed"
            : "releaseDecision.layers.createFailed"
        )
      )
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (layer: Layer) => archiveLayer(envId, layer.id),
    onSuccess: () => {
      setArchiveTarget(null)
      toast.success(t("releaseDecision.layers.archiveSucceeded"))
      if ((listQuery.data?.items.length ?? 0) === 1 && pageIndex > 1) {
        setPageIndex((current) => current - 1)
      }
      void queryClient.invalidateQueries({ queryKey: ["layers"] })
    },
    onError: () => toast.error(t("releaseDecision.layers.archiveFailed")),
  })

  const restoreMutation = useMutation({
    mutationFn: (layer: Layer) => restoreLayer(envId, layer.id),
    onSuccess: () => {
      toast.success(t("releaseDecision.layers.restoreSucceeded"))
      if ((listQuery.data?.items.length ?? 0) === 1 && pageIndex > 1) {
        setPageIndex((current) => current - 1)
      }
      void queryClient.invalidateQueries({ queryKey: ["layers"] })
    },
    onError: () => toast.error(t("releaseDecision.layers.restoreFailed")),
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
            {t("releaseDecision.layers.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("releaseDecision.layers.subtitle")}
          </p>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                className="pl-9"
                placeholder={t("releaseDecision.layers.search")}
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
              {t("releaseDecision.layers.showArchived")}
            </Button>
          </div>

          <Button type="button" onClick={() => setSheetLayer(null)}>
            <Plus />
            {t("releaseDecision.layers.new")}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border bg-background">
          {!envId || listQuery.isError ? (
            <div className="flex items-center justify-between border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
              <span>{t("releaseDecision.layers.loadFailed")}</span>
              {envId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void listQuery.refetch()}
                >
                  {t("releaseDecision.layers.retry")}
                </Button>
              ) : null}
            </div>
          ) : null}
          <LayersTable
            items={data.items}
            loading={listQuery.isLoading}
            archived={archived}
            query={debouncedSearch}
            lang={lang}
            mutatingId={mutatingId}
            onCopy={async (key) => {
              try {
                await navigator.clipboard.writeText(key)
                toast.success(t("releaseDecision.layers.copied"))
              } catch {
                toast.error(t("releaseDecision.layers.copyFailed"))
              }
            }}
            onEdit={setSheetLayer}
            onArchive={(layer) => {
              setArchiveConfirmationKey("")
              setArchiveTarget(layer)
            }}
            onRestore={(layer) => restoreMutation.mutate(layer)}
            onClearSearch={() => setSearch("")}
            onCreate={() => setSheetLayer(null)}
          />
        </div>

        <LayersPagination
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

        {sheetLayer !== undefined ? (
          <LayerSheet
            layer={sheetLayer}
            saving={saveMutation.isPending}
            onOpenChange={(open) => {
              if (!open) setSheetLayer(undefined)
            }}
            onSubmit={(payload) =>
              saveMutation
                .mutateAsync({ layer: sheetLayer, payload })
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
                {t("releaseDecision.layers.archiveTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {archiveTarget ? (
                  <>
                    {t("releaseDecision.layers.archiveDescriptionBefore")}
                    <strong className="font-semibold text-foreground">
                      {archiveTarget.name}
                    </strong>
                    {t("releaseDecision.layers.archiveDescriptionAfter")}
                  </>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {archiveTarget ? (
              <div className="space-y-2">
                <p
                  id="layer-archive-key-prompt"
                  className="flex flex-wrap items-center gap-1.5 text-sm font-medium"
                >
                  <span>
                    {t("releaseDecision.layers.archiveKeyPromptBefore")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 border-primary/40 bg-primary/5 px-1.5 font-mono text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                    disabled={archiveMutation.isPending}
                    aria-label={t("releaseDecision.layers.useArchiveKey", {
                      key: archiveTarget.key,
                    })}
                    onClick={() => setArchiveConfirmationKey(archiveTarget.key)}
                  >
                    <MousePointerClick className="size-3" />
                    {archiveTarget.key}
                  </Button>
                  <span>
                    {t("releaseDecision.layers.archiveKeyPromptAfter")}
                  </span>
                </p>
                <Input
                  id="layer-archive-key"
                  aria-labelledby="layer-archive-key-prompt"
                  value={archiveConfirmationKey}
                  placeholder={t(
                    "releaseDecision.layers.archiveKeyPlaceholder"
                  )}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) =>
                    setArchiveConfirmationKey(event.target.value)
                  }
                />
              </div>
            ) : null}
            <AlertDialogFooter className="border-t-0 bg-transparent">
              <AlertDialogCancel disabled={archiveMutation.isPending}>
                {t("releaseDecision.layers.form.cancel")}
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
                {t("releaseDecision.layers.archive")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
