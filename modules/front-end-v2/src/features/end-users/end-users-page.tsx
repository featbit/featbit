import "./end-users-i18n"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, MoreHorizontal, Settings, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import {
  getCurrentProjectEnv,
  resolveLang,
} from "@/features/layout/layout-context"
import { cn } from "@/lib/utils"
import {
  downloadEndUsers,
  fetchEndUserProperties,
  fetchEndUsers,
  saveJsonFile,
  uploadEndUsers,
} from "./end-users-api"
import type { EndUser, PageCursor } from "./end-users-types"
import { DetailsSheet } from "./components/details-sheet"
import { DisplayColumnsMenu } from "./components/display-columns-menu"
import { DownloadUsersDialog } from "./components/download-users-dialog"
import { EvaluateSheet } from "./components/evaluate-sheet"
import { ImportUsersDialog } from "./components/import-users-dialog"
import { PropertiesSheet } from "./components/properties-sheet"
import {
  CursorPagination,
  SearchInput,
  TableMessage,
  TableSkeleton,
  TruncatedValue,
} from "./components/shared"

type CursorState = {
  value?: PageCursor
  direction: "previous" | "next" | null
}

export function EndUsersPage() {
  const { t } = useTranslation()
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const queryClient = useQueryClient()
  const envId = getCurrentProjectEnv()?.envId ?? ""
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageSize, setPageSize] = useState(10)
  const [cursor, setCursor] = useState<CursorState>({ direction: null })
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadLimitExceeded, setDownloadLimitExceeded] = useState(false)
  const [evaluateUser, setEvaluateUser] = useState<EndUser | null>(null)
  const [detailsUser, setDetailsUser] = useState<EndUser | null>(null)
  const [propertiesOpen, setPropertiesOpen] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setCursor({ direction: null })
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    if (!envId) return
    try {
      const raw = localStorage.getItem(selectedColumnsStorageKey(envId))
      const stored = raw ? (JSON.parse(raw) as { attributes?: string[] }) : {}
      setSelectedColumns(stored.attributes ?? [])
    } catch {
      setSelectedColumns([])
    }
  }, [envId])

  const listQuery = useQuery({
    queryKey: [
      "end-users",
      envId,
      "list",
      debouncedSearch,
      pageSize,
      cursor.value ?? null,
    ],
    queryFn: () =>
      fetchEndUsers(
        envId,
        { searchText: debouncedSearch, pageSize },
        cursor.value
      ),
    enabled: Boolean(envId),
  })
  const propertiesQuery = useQuery({
    queryKey: ["end-users", envId, "properties"],
    queryFn: () => fetchEndUserProperties(envId),
    enabled: Boolean(envId),
    staleTime: 60_000,
  })

  const properties = useMemo(
    () => propertiesQuery.data ?? [],
    [propertiesQuery.data]
  )
  const propertyOptions = properties
    .filter((property) => !property.isBuiltIn)
    .map((property) => property.name)
  const propertyByName = useMemo(
    () => new Map(properties.map((property) => [property.name, property])),
    [properties]
  )
  const data = listQuery.data ?? { items: [] }

  const importMutation = useMutation({
    mutationFn: (file: File) => uploadEndUsers(envId, file),
    onSuccess: () => {
      setImportOpen(false)
      setImportError(null)
      setCursor({ direction: null })
      toast.success(t("endUsers.importDialog.success"))
      void queryClient.invalidateQueries({
        queryKey: ["end-users", envId, "list"],
      })
      void queryClient.invalidateQueries({
        queryKey: ["end-users", envId, "properties"],
      })
    },
    onError: () => setImportError(t("endUsers.importDialog.error")),
  })
  const downloadMutation = useMutation({
    mutationFn: () =>
      downloadEndUsers(envId, { searchText: debouncedSearch, pageSize }),
    onSuccess: (result) => {
      saveJsonFile(result, "end-users.json")
      setDownloadOpen(false)
      setDownloadLimitExceeded(false)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : ""
      if (
        message.includes("EndUserLimitExceeded") ||
        message.includes("Unprocessable")
      ) {
        setDownloadLimitExceeded(true)
      } else {
        toast.error(t("endUsers.operationFailed"))
      }
    },
  })

  const columns = useMemo<ColumnDef<EndUser>[]>(
    () => [
      {
        accessorKey: "name",
        size: 180,
        header: t("endUsers.name"),
        cell: ({ row }) =>
          row.original.name ? (
            <TruncatedValue value={row.original.name} />
          ) : (
            <span className="text-muted-foreground">
              {t("endUsers.unnamed")}
            </span>
          ),
      },
      {
        accessorKey: "keyId",
        size: 200,
        header: t("endUsers.keyId"),
        cell: ({ row }) => <TruncatedValue value={row.original.keyId} mono />,
      },
      ...selectedColumns.map((column): ColumnDef<EndUser> => ({
        id: column,
        size: 180,
        header: column,
        cell: ({ row }) => {
          const rawValue =
            row.original.customizedProperties?.find(
              (property) => property.name === column
            )?.value ?? ""
          const definition = propertyByName.get(column)
          const description = definition?.presetValues.find(
            (preset) => preset.value === rawValue
          )?.description
          const value =
            rawValue && description ? `${description} (${rawValue})` : rawValue
          return <TruncatedValue value={value} muted={!value} />
        },
      })),
      {
        id: "actions",
        size: 150,
        header: t("endUsers.actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => setEvaluateUser(row.original)}
            >
              {t("endUsers.evaluate")}
            </Button>
            <span className="h-4 w-px bg-border" />
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => setDetailsUser(row.original)}
            >
              {t("endUsers.details")}
            </Button>
          </div>
        ),
      },
    ],
    [propertyByName, selectedColumns, t]
  )
  // TanStack Table exposes intentionally non-memoizable callbacks.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  function changeSelectedColumns(columns: string[]) {
    setSelectedColumns(columns)
    if (envId) {
      localStorage.setItem(
        selectedColumnsStorageKey(envId),
        JSON.stringify({ attributes: columns })
      )
    }
  }

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              placeholder={t("endUsers.search")}
              className="w-80"
              onChange={setSearch}
            />
            <DisplayColumnsMenu
              options={propertyOptions}
              selected={selectedColumns}
              loading={propertiesQuery.isLoading}
              onChange={changeSelectedColumns}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              {t("endUsers.import")}
            </Button>
            <Button onClick={() => setPropertiesOpen(true)}>
              <Settings />
              {t("endUsers.properties")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button type="button" variant="outline" size="icon" />}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setDownloadLimitExceeded(false)
                    setDownloadOpen(true)
                  }}
                >
                  <Download />
                  {t("endUsers.download")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          {listQuery.isError ? (
            <div className="flex items-center justify-between border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
              {t("endUsers.loadFailed")}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void listQuery.refetch()}
              >
                {t("endUsers.retry")}
              </Button>
            </div>
          ) : null}
          <Table
            className="table-fixed"
            style={{ minWidth: Math.max(760, table.getTotalSize()) }}
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const headerContent = header.column.columnDef.header
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "overflow-hidden px-5 py-4 font-semibold",
                          header.column.id === "actions" &&
                            "sticky right-0 z-20 bg-background"
                        )}
                        style={{ width: header.getSize() }}
                      >
                        <div
                          className="truncate"
                          title={
                            typeof headerContent === "string"
                              ? headerContent
                              : undefined
                          }
                        >
                          {flexRender(headerContent, header.getContext())}
                        </div>
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                <TableSkeleton columns={columns.length} rows={pageSize} />
              ) : !data.items.length ? (
                debouncedSearch ? (
                  <TableMessage
                    columns={columns.length}
                    title={t("endUsers.emptySearch")}
                    action={
                      <Button variant="outline" onClick={() => setSearch("")}>
                        {t("endUsers.clearSearch")}
                      </Button>
                    }
                  />
                ) : (
                  <TableMessage
                    columns={columns.length}
                    title={t("endUsers.empty")}
                    action={
                      <Button
                        variant="outline"
                        onClick={() => setImportOpen(true)}
                      >
                        {t("endUsers.importUsers")}
                      </Button>
                    }
                  />
                )
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.original.id} className="group">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "overflow-hidden px-5 py-4 align-middle",
                          cell.column.id === "actions" &&
                            "sticky right-0 z-10 bg-background transition-colors group-hover:bg-muted/50"
                        )}
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <CursorPagination
          pageSize={pageSize}
          hasPrevious={Boolean(data.previousCursor)}
          hasNext={Boolean(data.nextCursor)}
          disabled={listQuery.isFetching}
          previousLabel={t("endUsers.previous")}
          nextLabel={t("endUsers.next")}
          perPageLabel={(size) => t("endUsers.perPage", { count: size })}
          onPrevious={() =>
            setCursor({
              value: data.previousCursor,
              direction: "previous",
            })
          }
          onNext={() =>
            setCursor({ value: data.nextCursor, direction: "next" })
          }
          onPageSizeChange={(size) => {
            setPageSize(size)
            setCursor({ direction: null })
          }}
        />

        <ImportUsersDialog
          open={importOpen}
          importing={importMutation.isPending}
          error={importError}
          onOpenChange={(open) => {
            setImportOpen(open)
            if (!open) setImportError(null)
          }}
          onImport={(file) => importMutation.mutate(file)}
        />
        <DownloadUsersDialog
          open={downloadOpen}
          downloading={downloadMutation.isPending}
          limitExceeded={downloadLimitExceeded}
          onOpenChange={(open) => {
            setDownloadOpen(open)
            if (!open) setDownloadLimitExceeded(false)
          }}
          onConfirm={() => downloadMutation.mutate()}
        />
        {evaluateUser ? (
          <EvaluateSheet
            key={evaluateUser.id}
            envId={envId}
            user={evaluateUser}
            lang={lang}
            onOpenChange={(open) => !open && setEvaluateUser(null)}
          />
        ) : null}
        {detailsUser ? (
          <DetailsSheet
            key={detailsUser.id}
            user={detailsUser}
            onOpenChange={(open) => !open && setDetailsUser(null)}
          />
        ) : null}
        {propertiesOpen ? (
          <PropertiesSheet
            envId={envId}
            open
            properties={properties}
            loading={propertiesQuery.isLoading}
            error={propertiesQuery.isError}
            onRetry={() => void propertiesQuery.refetch()}
            onOpenChange={setPropertiesOpen}
          />
        ) : null}
      </div>
    </TooltipProvider>
  )
}

function selectedColumnsStorageKey(envId: string) {
  const profileId = getStoredUserProfile().id
  return `current-user-search-filter-attribute${profileId ? `_${profileId}` : ""}_${envId}`
}
