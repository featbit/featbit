import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Plus,
  Search,
  Webhook as WebhookIcon,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentWorkspace } from "@/features/layout/layout-context"
import {
  LiveDebugDialog,
  type DebugConfiguration,
} from "./components/live-debug-dialog"
import { RemoveWebhookDialog } from "./components/remove-webhook-dialog"
import { ViewLogsSheet } from "./components/view-logs-sheet"
import { WebhookSheet } from "./components/webhook-sheet"
import { WebhooksTable } from "./components/webhooks-table"
import {
  createWebhook,
  fetchWebhookEnvironmentResources,
  fetchWebhookProjects,
  fetchWebhooks,
  removeWebhook,
  updateWebhook,
} from "./webhooks-api"
import type { Webhook, WebhookPayload, WebhookSheetMode } from "./webhook-types"

type SheetState = {
  mode: WebhookSheetMode
  webhook: Webhook | null
} | null

function savedDebugConfiguration(webhook: Webhook): DebugConfiguration {
  return {
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    secret: webhook.secret,
    headers: webhook.headers,
    events: webhook.events,
    payloadTemplate: webhook.payloadTemplate,
    preventEmptyPayloads: webhook.preventEmptyPayloads,
  }
}

export function WebhooksPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const workspace = getCurrentWorkspace()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [projectId, setProjectId] = useState("")
  const [projectFilterOpen, setProjectFilterOpen] = useState(false)
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [removeTarget, setRemoveTarget] = useState<Webhook | null>(null)
  const [debugWebhook, setDebugWebhook] = useState<DebugConfiguration | null>(
    null
  )
  const [logsWebhook, setLogsWebhook] = useState<Webhook | null>(null)

  useEffect(() => {
    if (search.trim() === debouncedSearch) return

    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search, debouncedSearch])

  const projectsQuery = useQuery({
    queryKey: ["webhook-projects", workspace?.id ?? ""],
    queryFn: fetchWebhookProjects,
    staleTime: 5 * 60_000,
  })
  const listQuery = useQuery({
    queryKey: [
      "webhooks",
      workspace?.id ?? "",
      debouncedSearch,
      projectId,
      pageIndex,
      pageSize,
    ],
    queryFn: () =>
      fetchWebhooks({
        name: debouncedSearch,
        projectId,
        pageIndex: pageIndex - 1,
        pageSize,
      }),
  })
  const environmentQuery = useQuery({
    queryKey: ["webhook-environments", workspace?.id ?? ""],
    queryFn: fetchWebhookEnvironmentResources,
    enabled: Boolean(sheet),
    staleTime: 5 * 60_000,
  })

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
    [queryClient]
  )

  const saveMutation = useMutation({
    mutationFn: async ({
      mode,
      webhook,
      payload,
    }: {
      mode: WebhookSheetMode
      webhook: Webhook | null
      payload: WebhookPayload
    }) => {
      if (mode === "new") return createWebhook(payload)
      if (!webhook) throw new Error(t("webhooks.saveFailed"))
      return updateWebhook(webhook.id, payload)
    },
    onSuccess: (_, variables) => {
      setSheet(null)
      toast.success(
        t(variables.mode === "new" ? "webhooks.created" : "webhooks.updated")
      )
      if (variables.mode === "new") setPageIndex(1)
      void invalidateList()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (webhook: Webhook) => removeWebhook(webhook.id),
    onSuccess: () => {
      setRemoveTarget(null)
      toast.success(t("webhooks.removed"))
      if ((listQuery.data?.items.length ?? 0) === 1 && pageIndex > 1) {
        setPageIndex((current) => current - 1)
      }
      void invalidateList()
    },
    onError: () => toast.error(t("webhooks.removeFailed")),
  })

  const data = listQuery.data ?? { totalCount: 0, items: [] }
  const pageCount = Math.max(1, Math.ceil(data.totalCount / pageSize))
  const from = data.totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const to = Math.min(pageIndex * pageSize, data.totalCount)
  const filtersActive = Boolean(debouncedSearch || projectId)
  const selectedProject = projectsQuery.data?.find(
    (project) => project.id === projectId
  )

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
      <header className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("webhooks.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("webhooks.subtitle")}
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("webhooks.search")}
              className="pl-9"
            />
          </div>
          <Popover open={projectFilterOpen} onOpenChange={setProjectFilterOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="w-64 justify-between font-normal"
                  disabled={projectsQuery.isLoading || projectsQuery.isError}
                  aria-expanded={projectFilterOpen}
                />
              }
            >
              <span className="truncate">
                {selectedProject?.name ?? t("webhooks.allProjects")}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <Command>
                <CommandInput placeholder={t("webhooks.projectSearch")} />
                <CommandList>
                  <CommandEmpty>{t("webhooks.projectEmpty")}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value={t("webhooks.allProjects")}
                      data-checked={!projectId}
                      onSelect={() => {
                        setProjectId("")
                        setPageIndex(1)
                        setProjectFilterOpen(false)
                      }}
                    >
                      {t("webhooks.allProjects")}
                    </CommandItem>
                    {(projectsQuery.data ?? []).map((project) => (
                      <CommandItem
                        key={project.id}
                        value={`${project.name} ${project.key}`}
                        data-checked={project.id === projectId}
                        onSelect={() => {
                          setProjectId(project.id)
                          setPageIndex(1)
                          setProjectFilterOpen(false)
                        }}
                      >
                        <span className="truncate">{project.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {projectsQuery.isError ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void projectsQuery.refetch()}
            >
              {t("webhooks.projectLoadFailed")} {t("webhooks.retry")}
            </Button>
          ) : null}
        </div>
        <Button onClick={() => setSheet({ mode: "new", webhook: null })}>
          <Plus /> {t("webhooks.new")}
        </Button>
      </div>

      {listQuery.isError ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">{t("webhooks.loadFailed")}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void listQuery.refetch()}
          >
            {t("webhooks.retry")}
          </Button>
        </div>
      ) : !listQuery.isLoading && data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <WebhookIcon className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="font-medium">
            {t(filtersActive ? "webhooks.filteredEmpty" : "webhooks.empty")}
          </p>
          {!filtersActive ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("webhooks.emptyHelper")}
            </p>
          ) : null}
          {filtersActive ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearch("")
                setDebouncedSearch("")
                setProjectId("")
                setPageIndex(1)
              }}
            >
              {t("webhooks.clearFilters")}
            </Button>
          ) : (
            <Button
              className="mt-4"
              onClick={() => setSheet({ mode: "new", webhook: null })}
            >
              <Plus /> {t("webhooks.new")}
            </Button>
          )}
        </div>
      ) : (
        <WebhooksTable
          items={data.items}
          isLoading={listQuery.isLoading}
          onView={(webhook) => setSheet({ mode: "view", webhook })}
          onEdit={(webhook) => setSheet({ mode: "edit", webhook })}
          onDebug={(webhook) =>
            setDebugWebhook(savedDebugConfiguration(webhook))
          }
          onViewLogs={setLogsWebhook}
          onRemove={setRemoveTarget}
        />
      )}

      {listQuery.isLoading && !listQuery.data ? (
        <div className="mt-4 flex items-center justify-between">
          <Skeleton className="h-5 w-60" />
          <Skeleton className="h-9 w-80" />
        </div>
      ) : data.totalCount > 0 ? (
        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>
            {t("webhooks.showing", { from, to, total: data.totalCount })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={pageIndex <= 1}
              aria-label={t("webhooks.previous")}
              onClick={() => setPageIndex((current) => current - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-14 text-center text-foreground">
              {pageIndex} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={pageIndex >= pageCount}
              aria-label={t("webhooks.next")}
              onClick={() => setPageIndex((current) => current + 1)}
            >
              <ChevronRight />
            </Button>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                if (!value) return
                setPageSize(Number(value))
                setPageIndex(1)
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue>
                  {t("webhooks.perPage", { count: pageSize })}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {[10, 20, 30].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {t("webhooks.perPage", { count: size })}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {sheet ? (
        <WebhookSheet
          key={`${sheet.mode}-${sheet.webhook?.id ?? "new"}`}
          open
          mode={sheet.mode}
          webhook={sheet.webhook}
          projects={projectsQuery.data ?? []}
          environments={environmentQuery.data ?? []}
          environmentsLoading={environmentQuery.isLoading}
          environmentsError={environmentQuery.isError}
          isSaving={saveMutation.isPending}
          liveDebugOpen={Boolean(debugWebhook)}
          onOpenChange={(nextOpen) => !nextOpen && setSheet(null)}
          onModeChange={(mode) => setSheet({ mode, webhook: sheet.webhook })}
          onRetryEnvironments={() => void environmentQuery.refetch()}
          onDebug={setDebugWebhook}
          onSubmit={(payload) =>
            saveMutation
              .mutateAsync({
                mode: sheet.mode,
                webhook: sheet.webhook,
                payload,
              })
              .then(() => undefined)
          }
        />
      ) : null}

      <LiveDebugDialog
        key={
          debugWebhook
            ? `${debugWebhook.id}-${debugWebhook.events.join(",")}`
            : "closed"
        }
        open={Boolean(debugWebhook)}
        webhook={debugWebhook}
        onOpenChange={(nextOpen) => !nextOpen && setDebugWebhook(null)}
      />
      <ViewLogsSheet
        open={Boolean(logsWebhook)}
        webhook={logsWebhook}
        onOpenChange={(nextOpen) => !nextOpen && setLogsWebhook(null)}
      />
      <RemoveWebhookDialog
        target={removeTarget}
        isRemoving={removeMutation.isPending}
        onOpenChange={(nextOpen) => !nextOpen && setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget)}
      />
    </div>
  )
}
