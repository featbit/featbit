import { ChevronsUpDown, Upload } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getCurrentWorkspace,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { WorkspaceLayout } from "@/features/workspace/components/workspace-layout"
import { DetailsDrawer } from "@/features/workspace/global-users/components/details-drawer"
import { DisplayColumnsMenu } from "@/features/workspace/global-users/components/display-columns-menu"
import { EvaluateDrawer } from "@/features/workspace/global-users/components/evaluate-drawer"
import { ImportUsersModal } from "@/features/workspace/global-users/components/import-users-modal"
import { Pagination } from "@/features/workspace/global-users/components/pagination"
import {
  ActionLink,
  SearchBox,
  StatusMessage,
  TableSkeleton,
  TextCell,
} from "@/features/workspace/global-users/components/shared"
import {
  fetchGlobalUsers,
  uploadGlobalUsers,
  type GlobalUser,
  type PagedResult,
} from "@/features/workspace/global-users/global-users-api"
import {
  getLicenseStatus,
  isFeatureGranted,
  parseLicense,
} from "@/features/workspace/license/license-utils"
import {
  fetchWorkspaceDetails,
  type WorkspaceDetails,
} from "@/features/workspace/workspace-api"
import { cn } from "@/lib/utils"

export function GlobalUsersPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(() =>
    getCurrentWorkspace()
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusVariant, setStatusVariant] = useState<"success" | "error">(
    "success"
  )
  const [statusEventId, setStatusEventId] = useState(0)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<PagedResult<GlobalUser>>({
    totalCount: 0,
    items: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customColumnOptions, setCustomColumnOptions] = useState<string[]>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [evaluateUser, setEvaluateUser] = useState<GlobalUser | null>(null)
  const [detailsUser, setDetailsUser] = useState<GlobalUser | null>(null)

  const license = useMemo(
    () => parseLicense(workspace?.license),
    [workspace?.license]
  )
  const licenseStatus = getLicenseStatus(license)
  const isGlobalUsersLicensed = isFeatureGranted(
    { id: "global-user", labelKey: "", descriptionKey: "" },
    license,
    licenseStatus
  )

  function showStatus(message: string, variant: "success" | "error") {
    setStatusVariant(variant)
    setStatusMessage(message)
    setStatusEventId((current) => current + 1)
  }

  useEffect(() => {
    let cancelled = false

    fetchWorkspaceDetails()
      .then((loadedWorkspace) => {
        if (!cancelled) {
          setWorkspace((current) => ({
            ...loadedWorkspace,
            license: loadedWorkspace.license ?? current?.license,
          }))
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 200)
    return () => window.clearTimeout(timeout)
  }, [search])

  const loadData = useCallback(() => {
    if (!isGlobalUsersLicensed) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    fetchGlobalUsers({
      name: debouncedSearch,
      pageIndex: pageIndex - 1,
      pageSize,
    })
      .then((result) => {
        setData(result)
        setCustomColumnOptions((current) => {
          const next = new Set(current)
          result.items.forEach((user) =>
            user.customizedProperties?.forEach((property) =>
              next.add(property.name)
            )
          )
          return Array.from(next)
        })
      })
      .catch((requestError) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : t("workspace.globalUsers.failedToLoad")
        )
      )
      .finally(() => setIsLoading(false))
  }, [debouncedSearch, isGlobalUsersLicensed, pageIndex, pageSize, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const columns = useMemo<ColumnDef<GlobalUser>[]>(
    () => [
      {
        accessorKey: "keyId",
        header: "keyId",
        cell: ({ row }) => <TextCell value={row.original.keyId} />,
      },
      {
        accessorKey: "name",
        header: t("workspace.globalUsers.name"),
        cell: ({ row }) =>
          row.original.name ? (
            <TextCell value={row.original.name} />
          ) : (
            <span className="text-muted-foreground">
              {t("workspace.globalUsers.unnamedUser")}
            </span>
          ),
      },
      ...selectedColumns.map(
        (column): ColumnDef<GlobalUser> => ({
          id: column,
          header: column,
          cell: ({ row }) => {
            const value =
              row.original.customizedProperties?.find(
                (property) => property.name === column
              )?.value ?? ""
            return <TextCell value={value} muted={!value} />
          },
        })
      ),
      {
        id: "actions",
        header: t("workspace.globalUsers.actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ActionLink onClick={() => setEvaluateUser(row.original)}>
              {t("workspace.globalUsers.evaluateAction")}
            </ActionLink>
            <span className="h-4 w-px bg-border" />
            <ActionLink onClick={() => setDetailsUser(row.original)}>
              {t("workspace.globalUsers.detailsAction")}
            </ActionLink>
          </div>
        ),
      },
    ],
    [selectedColumns, t]
  )

  const table = useReactTable({
    data: data.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  async function onImport(file: File) {
    setIsUploading(true)
    setImportError(null)
    try {
      await uploadGlobalUsers(file)
      setImportOpen(false)
      showStatus(t("workspace.globalUsers.import.success"), "success")
      loadData()
    } catch {
      setImportError(t("workspace.globalUsers.import.error"))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <TooltipProvider>
      <WorkspaceLayout
        workspace={workspace}
        lang={lang}
        activeTab="global-users"
        statusMessage={statusMessage}
        statusVariant={statusVariant}
        statusEventId={statusEventId}
      >
        <div className="pb-8 pt-7">
          <GlobalUsersToolbar
            search={search}
            isLoading={isLoading}
            isGlobalUsersLicensed={isGlobalUsersLicensed}
            customColumnOptions={customColumnOptions}
            selectedColumns={selectedColumns}
            onSearchChange={setSearch}
            onSelectedColumnsChange={setSelectedColumns}
            onImportClick={() => setImportOpen(true)}
          />

          <div className="overflow-hidden rounded-md border bg-background">
            {error ? (
              <div className="flex items-center justify-between border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
                {t("workspace.globalUsers.failedToLoad")}
                <Button type="button" variant="outline" size="sm" onClick={loadData}>
                  {t("workspace.globalUsers.retry")}
                </Button>
              </div>
            ) : null}
            <GlobalUsersTable
              columnsCount={columns.length}
              isGlobalUsersLicensed={isGlobalUsersLicensed}
              isLoading={isLoading}
              hasSearch={Boolean(debouncedSearch)}
              table={table}
              lang={lang}
              onClearSearch={() => setSearch("")}
              onImportClick={() => setImportOpen(true)}
            />
          </div>
          {isGlobalUsersLicensed ? (
            <Pagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalCount={data.totalCount}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize)
                setPageIndex(1)
              }}
            />
          ) : null}
        </div>
        <ImportUsersModal
          open={importOpen}
          uploading={isUploading}
          error={importError}
          onClose={() => setImportOpen(false)}
          onImport={onImport}
        />
        <EvaluateDrawer
          user={evaluateUser}
          lang={lang}
          onClose={() => setEvaluateUser(null)}
          onCopied={() => showStatus(t("workspace.globalUsers.copied"), "success")}
        />
        <DetailsDrawer
          user={detailsUser}
          onClose={() => setDetailsUser(null)}
          onCopied={() => showStatus(t("workspace.globalUsers.copied"), "success")}
        />
      </WorkspaceLayout>
    </TooltipProvider>
  )
}

function GlobalUsersToolbar({
  search,
  isLoading,
  isGlobalUsersLicensed,
  customColumnOptions,
  selectedColumns,
  onSearchChange,
  onSelectedColumnsChange,
  onImportClick,
}: {
  search: string
  isLoading: boolean
  isGlobalUsersLicensed: boolean
  customColumnOptions: string[]
  selectedColumns: string[]
  onSearchChange: (value: string) => void
  onSelectedColumnsChange: (columns: string[]) => void
  onImportClick: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBox
          value={search}
          placeholder={t("workspace.globalUsers.searchByName")}
          className="w-full sm:w-80"
          onChange={onSearchChange}
        />
        <DisplayColumnsMenu
          options={customColumnOptions}
          selectedColumns={selectedColumns}
          isLoading={isLoading}
          onChange={onSelectedColumnsChange}
        />
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <span>
              <Button
                type="button"
                disabled={!isGlobalUsersLicensed}
                onClick={onImportClick}
              >
                <Upload className="size-4" />
                {t("workspace.globalUsers.importAction")}
              </Button>
            </span>
          }
        />
        {!isGlobalUsersLicensed ? (
          <TooltipContent>
            {t("workspace.globalUsers.gated.tooltip")}
          </TooltipContent>
        ) : null}
      </Tooltip>
    </div>
  )
}

function GlobalUsersTable({
  columnsCount,
  isGlobalUsersLicensed,
  isLoading,
  hasSearch,
  table,
  lang,
  onClearSearch,
  onImportClick,
}: {
  columnsCount: number
  isGlobalUsersLicensed: boolean
  isLoading: boolean
  hasSearch: boolean
  table: ReturnType<typeof useReactTable<GlobalUser>>
  lang: "en" | "zh"
  onClearSearch: () => void
  onImportClick: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] table-fixed">
        <thead className="border-b text-left text-foreground">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-5 py-4 text-sm font-semibold"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {!isGlobalUsersLicensed ? (
            <tr>
              <td colSpan={columnsCount} className="p-0">
                <StatusMessage
                  title={t("workspace.globalUsers.gated.title")}
                  body={t("workspace.globalUsers.gated.body")}
                  action={
                    <Link
                      className={cn(buttonVariants({ variant: "outline" }))}
                      to={localizedPath(lang, "/app/workspace/license")}
                    >
                      {t("workspace.globalUsers.gated.action")}
                    </Link>
                  }
                />
              </td>
            </tr>
          ) : isLoading ? (
            <TableSkeleton columns={columnsCount} />
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columnsCount} className="p-0">
                {hasSearch ? (
                  <StatusMessage
                    title={t("workspace.globalUsers.emptySearch")}
                    action={
                      <Button type="button" variant="outline" onClick={onClearSearch}>
                        {t("workspace.globalUsers.clearSearch")}
                      </Button>
                    }
                  />
                ) : (
                  <StatusMessage
                    title={t("workspace.globalUsers.empty")}
                    action={
                      <Button type="button" variant="outline" onClick={onImportClick}>
                        {t("workspace.globalUsers.importUsers")}
                      </Button>
                    }
                  />
                )}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-5 py-4 align-middle text-sm text-foreground"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
