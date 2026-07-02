import { ChevronsUpDown, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCurrentWorkspace, localizedPath } from "@/features/layout/context";
import { fetchWorkspaceDetails, type WorkspaceDetails } from "../workspace-api";
import { WorkspaceLayout } from "../workspace-layout";
import { getLicenseStatus, isFeatureGranted, parseLicense } from "../license/license-utils";
import { DetailsDrawer } from "./components/details-drawer";
import { DisplayColumnsMenu } from "./components/display-columns-menu";
import { EvaluateDrawer } from "./components/evaluate-drawer";
import { ImportUsersModal } from "./components/import-users-modal";
import { Pagination } from "./components/pagination";
import { ActionLink, SearchBox, StatusMessage, TableSkeleton, TextCell } from "./components/shared";
import {
  fetchGlobalUsers,
  uploadGlobalUsers,
  type GlobalUser,
  type PagedResult
} from "./global-users-api";

export function GlobalUsersPage({ lang }: { lang: "en" | "zh" }) {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useState<WorkspaceDetails>(() => getCurrentWorkspace());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<PagedResult<GlobalUser>>({ totalCount: 0, items: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customColumnOptions, setCustomColumnOptions] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [evaluateUser, setEvaluateUser] = useState<GlobalUser | null>(null);
  const [detailsUser, setDetailsUser] = useState<GlobalUser | null>(null);

  const license = useMemo(() => parseLicense(workspace.license), [workspace.license]);
  const licenseStatus = getLicenseStatus(license);
  const isGlobalUsersLicensed = isFeatureGranted({ id: "global-user", labelKey: "", descriptionKey: "" }, license, licenseStatus);

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceDetails()
      .then((loadedWorkspace) => {
        if (!cancelled) {
          setWorkspace((current) => ({ ...loadedWorkspace, license: loadedWorkspace.license ?? current.license }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPageIndex(1);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [search]);

  function loadData() {
    if (!isGlobalUsersLicensed) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    fetchGlobalUsers({ name: debouncedSearch, pageIndex: pageIndex - 1, pageSize })
      .then((result) => {
        setData(result);
        setCustomColumnOptions((current) => {
          const next = new Set(current);
          result.items.forEach((user) => user.customizedProperties?.forEach((property) => next.add(property.name)));
          return Array.from(next);
        });
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : t("workspace.globalUsers.failedToLoad")))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, pageIndex, pageSize, isGlobalUsersLicensed]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const columns = useMemo<ColumnDef<GlobalUser>[]>(() => [
    {
      accessorKey: "keyId",
      header: "keyId",
      cell: ({ row }) => <TextCell value={row.original.keyId} />
    },
    {
      accessorKey: "name",
      header: t("workspace.globalUsers.name"),
      cell: ({ row }) => row.original.name ? <TextCell value={row.original.name} /> : <span className="text-muted-foreground">{t("workspace.globalUsers.unnamedUser")}</span>
    },
    ...selectedColumns.map((column): ColumnDef<GlobalUser> => ({
      id: column,
      header: column,
      cell: ({ row }) => {
        const value = row.original.customizedProperties?.find((property) => property.name === column)?.value ?? "";
        return <TextCell value={value} muted={!value} />;
      }
    })),
    {
      id: "actions",
      header: t("workspace.globalUsers.actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <ActionLink onClick={() => setEvaluateUser(row.original)}>{t("workspace.globalUsers.evaluateAction")}</ActionLink>
          <span className="h-4 w-px bg-border" />
          <ActionLink onClick={() => setDetailsUser(row.original)}>{t("workspace.globalUsers.detailsAction")}</ActionLink>
        </div>
      )
    }
  ], [selectedColumns, t]);

  const table = useReactTable({
    data: data.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true
  });

  async function onImport(file: File) {
    setIsUploading(true);
    setImportError(null);
    try {
      await uploadGlobalUsers(file);
      setImportOpen(false);
      setToastMessage(t("workspace.globalUsers.import.success"));
      loadData();
    } catch {
      setImportError(t("workspace.globalUsers.import.error"));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <TooltipProvider>
      <WorkspaceLayout workspace={workspace} lang={lang} activeTab="global-users" statusMessage={toastMessage}>
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

          <Card className="overflow-hidden rounded-md shadow-none">
            {error ? (
              <div className="flex items-center justify-between border-b border-border bg-destructive/5 px-5 py-3 text-sm text-destructive">
                {t("workspace.globalUsers.failedToLoad")}
                <Button variant="outline" size="sm" onClick={loadData}>{t("workspace.globalUsers.retry")}</Button>
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
          </Card>
          {isGlobalUsersLicensed ? (
            <Pagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalCount={data.totalCount}
              onPageIndexChange={setPageIndex}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setPageIndex(1);
              }}
            />
          ) : null}
        </div>
        <ImportUsersModal open={importOpen} uploading={isUploading} error={importError} onClose={() => setImportOpen(false)} onImport={onImport} />
        <EvaluateDrawer user={evaluateUser} lang={lang} onClose={() => setEvaluateUser(null)} onCopied={() => setToastMessage(t("workspace.globalUsers.copied"))} />
        <DetailsDrawer user={detailsUser} onClose={() => setDetailsUser(null)} onCopied={() => setToastMessage(t("workspace.globalUsers.copied"))} />
      </WorkspaceLayout>
    </TooltipProvider>
  );
}

function GlobalUsersToolbar({
  search,
  isLoading,
  isGlobalUsersLicensed,
  customColumnOptions,
  selectedColumns,
  onSearchChange,
  onSelectedColumnsChange,
  onImportClick
}: {
  search: string;
  isLoading: boolean;
  isGlobalUsersLicensed: boolean;
  customColumnOptions: string[];
  selectedColumns: string[];
  onSearchChange: (value: string) => void;
  onSelectedColumnsChange: (columns: string[]) => void;
  onImportClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBox value={search} placeholder={t("workspace.globalUsers.searchByName")} className="w-full sm:w-80" onChange={onSearchChange} />
        <DisplayColumnsMenu options={customColumnOptions} selectedColumns={selectedColumns} isLoading={isLoading} onChange={onSelectedColumnsChange} />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button className="h-10 px-5" disabled={!isGlobalUsersLicensed} onClick={onImportClick}>
              <Upload className="h-4 w-4" />
              {t("workspace.globalUsers.importAction")}
            </Button>
          </span>
        </TooltipTrigger>
        {!isGlobalUsersLicensed ? <TooltipContent>{t("workspace.globalUsers.gated.tooltip")}</TooltipContent> : null}
      </Tooltip>
    </div>
  );
}

function GlobalUsersTable({
  columnsCount,
  isGlobalUsersLicensed,
  isLoading,
  hasSearch,
  table,
  lang,
  onClearSearch,
  onImportClick
}: {
  columnsCount: number;
  isGlobalUsersLicensed: boolean;
  isLoading: boolean;
  hasSearch: boolean;
  table: ReturnType<typeof useReactTable<GlobalUser>>;
  lang: "en" | "zh";
  onClearSearch: () => void;
  onImportClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[760px] table-fixed">
        <TableHeader className="border-b border-border text-left text-foreground">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="px-5 py-4 font-semibold text-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {!isGlobalUsersLicensed ? (
            <TableRow>
              <TableCell colSpan={columnsCount} className="p-0">
                <StatusMessage
                  title={t("workspace.globalUsers.gated.title")}
                  body={t("workspace.globalUsers.gated.body")}
                  action={<Button asChild variant="outline"><a href={localizedPath(lang, "/workspace/license")}>{t("workspace.globalUsers.gated.action")}</a></Button>}
                />
              </TableCell>
            </TableRow>
          ) : isLoading ? (
            <TableSkeleton columns={columnsCount} />
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnsCount} className="p-0">
                {hasSearch ? (
                  <StatusMessage title={t("workspace.globalUsers.emptySearch")} action={<Button variant="outline" onClick={onClearSearch}>{t("workspace.globalUsers.clearSearch")}</Button>} />
                ) : (
                  <StatusMessage title={t("workspace.globalUsers.empty")} action={<Button variant="outline" onClick={onImportClick}>{t("workspace.globalUsers.importUsers")}</Button>} />
                )}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="last:border-b-0">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-5 py-4 align-middle text-foreground">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
