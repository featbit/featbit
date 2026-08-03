import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Waypoints,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  createRelayProxy,
  fetchCurrentUserPolicies,
  fetchEnvironmentResources,
  fetchRelayProxies,
  isRelayProxyNameUsed,
  removeRelayProxy,
  updateRelayProxy,
} from "./relay-proxies-api"
import { canUseRelayProxies } from "./relay-proxy-permissions"
import type {
  RelayProxy,
  RelayProxyPayload,
  RelayProxySheetMode,
} from "./relay-proxy-types"
import {
  RelayProxyKeyDialog,
  RemoveRelayProxyDialog,
} from "./components/relay-proxy-dialogs"
import { RelayProxySheet } from "./components/relay-proxy-sheet"
import { RelayProxyTable } from "./components/relay-proxy-table"

type SheetState = {
  mode: RelayProxySheetMode
  relayProxy: RelayProxy | null
} | null

export function RelayProxiesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const workspace = getCurrentWorkspace()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [removeTarget, setRemoveTarget] = useState<RelayProxy | null>(null)
  const [createdRelayProxy, setCreatedRelayProxy] = useState<RelayProxy | null>(
    null
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const permissionsQuery = useQuery({
    queryKey: ["relay-proxy-user-policies", workspace?.id ?? ""],
    queryFn: fetchCurrentUserPolicies,
    staleTime: 5 * 60_000,
  })
  const policies = permissionsQuery.data ?? []
  const canList = canUseRelayProxies(policies, "ListRelayProxies")
  const canManage = canUseRelayProxies(policies, "ManageRelayProxies")

  const listQuery = useQuery({
    queryKey: [
      "relay-proxies",
      workspace?.id ?? "",
      debouncedSearch,
      pageIndex,
      pageSize,
    ],
    queryFn: () =>
      fetchRelayProxies({
        name: debouncedSearch,
        pageIndex: pageIndex - 1,
        pageSize,
      }),
    enabled: permissionsQuery.isSuccess && canList,
  })

  const environmentQuery = useQuery({
    queryKey: ["relay-proxy-environments", workspace?.id ?? ""],
    queryFn: () => fetchEnvironmentResources(),
    enabled: Boolean(sheet),
    staleTime: 5 * 60_000,
  })

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["relay-proxies"] }),
    [queryClient]
  )

  const saveMutation = useMutation({
    mutationFn: async ({
      mode,
      relayProxy,
      payload,
    }: {
      mode: RelayProxySheetMode
      relayProxy: RelayProxy | null
      payload: RelayProxyPayload
    }) => {
      if (mode === "new") return createRelayProxy(payload)
      if (!relayProxy) throw new Error("Relay proxy is missing")
      await updateRelayProxy(relayProxy.id, payload)
      return null
    },
    onSuccess: (created, variables) => {
      setSheet(null)
      if (variables.mode === "new" && created) setCreatedRelayProxy(created)
      toast.success(
        t(
          variables.mode === "new"
            ? "relayProxies.created"
            : "relayProxies.updated"
        )
      )
      void invalidateList()
    },
    onError: () => toast.error(t("relayProxies.saveFailed")),
  })

  const removeMutation = useMutation({
    mutationFn: (relayProxy: RelayProxy) => removeRelayProxy(relayProxy.id),
    onSuccess: () => {
      setRemoveTarget(null)
      toast.success(t("relayProxies.removed"))
      if ((listQuery.data?.items.length ?? 0) === 1 && pageIndex > 1) {
        setPageIndex((current) => current - 1)
      }
      void invalidateList()
    },
    onError: () => toast.error(t("relayProxies.removeFailed")),
  })

  const data = listQuery.data ?? { totalCount: 0, items: [] }
  const pageCount = Math.max(1, Math.ceil(data.totalCount / pageSize))
  const from = data.totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const to = Math.min(pageIndex * pageSize, data.totalCount)

  if (permissionsQuery.isLoading) {
    return (
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-3 h-4 w-96" />
        <Skeleton className="mt-10 h-96 w-full" />
      </div>
    )
  }

  if (permissionsQuery.isError || !canList) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-8">
        <div className="max-w-md text-center">
          <Waypoints className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">
            {t("relayProxies.unavailableTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("relayProxies.unavailableDescription")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
      <header className="mb-10 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("relayProxies.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("relayProxies.subtitle")}
        </p>
      </header>

      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("relayProxies.search")}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button onClick={() => setSheet({ mode: "new", relayProxy: null })}>
            <Plus /> {t("relayProxies.new")}
          </Button>
        )}
      </div>

      {listQuery.isError ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">{t("relayProxies.loadFailed")}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void listQuery.refetch()}
          >
            {t("relayProxies.retry")}
          </Button>
        </div>
      ) : !listQuery.isLoading && data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Waypoints className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="font-medium">
            {t(
              debouncedSearch
                ? "relayProxies.filteredEmpty"
                : "relayProxies.empty"
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              debouncedSearch
                ? "relayProxies.filteredEmptyHelper"
                : "relayProxies.emptyHelper"
            )}
          </p>
          {canManage && !debouncedSearch && (
            <Button
              className="mt-4"
              onClick={() => setSheet({ mode: "new", relayProxy: null })}
            >
              <Plus /> {t("relayProxies.new")}
            </Button>
          )}
        </div>
      ) : (
        <RelayProxyTable
          items={data.items}
          isLoading={listQuery.isLoading}
          canManage={canManage}
          onEdit={(relayProxy) => setSheet({ mode: "edit", relayProxy })}
          onView={(relayProxy) => setSheet({ mode: "view", relayProxy })}
          onRemove={setRemoveTarget}
        />
      )}

      {data.totalCount > 0 && (
        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>
            {t("relayProxies.showing", {
              from,
              to,
              total: data.totalCount,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={pageIndex <= 1}
              onClick={() => setPageIndex((current) => current - 1)}
            >
              <ChevronLeft />
              <span className="sr-only">{t("relayProxies.previous")}</span>
            </Button>
            <span className="min-w-14 text-center text-foreground">
              {pageIndex} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={pageIndex >= pageCount}
              onClick={() => setPageIndex((current) => current + 1)}
            >
              <ChevronRight />
              <span className="sr-only">{t("relayProxies.next")}</span>
            </Button>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPageIndex(1)
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue>
                  {t("relayProxies.perPage", { count: pageSize })}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {[10, 20, 30].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {t("relayProxies.perPage", { count: size })}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {sheet && (
        <RelayProxySheet
          key={`${sheet.mode}-${sheet.relayProxy?.id ?? "new"}`}
          open
          mode={sheet.mode}
          relayProxy={sheet.relayProxy}
          environments={environmentQuery.data ?? []}
          environmentsLoading={environmentQuery.isLoading}
          environmentsError={environmentQuery.isError}
          isSaving={saveMutation.isPending}
          onOpenChange={(open) => !open && setSheet(null)}
          onValidateName={async (name) => {
            try {
              return await isRelayProxyNameUsed(name)
            } catch {
              toast.error(t("relayProxies.nameValidationFailed"))
              return true
            }
          }}
          onRetryEnvironments={() => void environmentQuery.refetch()}
          onSubmit={(payload) =>
            saveMutation
              .mutateAsync({
                mode: sheet.mode,
                relayProxy: sheet.relayProxy,
                payload,
              })
              .then(() => undefined)
          }
        />
      )}

      <RemoveRelayProxyDialog
        target={removeTarget}
        isRemoving={removeMutation.isPending}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget)}
      />
      {createdRelayProxy && (
        <RelayProxyKeyDialog
          relayProxy={createdRelayProxy}
          onDone={() => setCreatedRelayProxy(null)}
        />
      )}
    </div>
  )
}
