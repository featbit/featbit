import { Copy, Plus, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { cn } from "@/lib/utils"
import { AddGroupSheet } from "../components/add-group-sheet"
import { GroupDataTable } from "../components/data-table"
import { GroupPagination } from "../components/pagination"
import { RemoveDialog } from "../components/remove-dialog"
import {
  deleteGroup,
  fetchGroups,
  groupResourceName,
  type Group,
} from "../group-api"
import { getGroupTranslations } from "../group-translations"

export function GroupPage() {
  const params = useParams()
  const lang = resolveLang(params.lang)
  const copy = useMemo(() => getGroupTranslations(lang), [lang])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<{ totalCount: number; items: Group[] }>({
    totalCount: 0,
    items: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Group | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const loadGroups = useCallback(() => {
    setLoading(true)
    setError(false)
    fetchGroups({
      name: debouncedSearch,
      pageIndex: pageIndex - 1,
      pageSize,
    })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [debouncedSearch, pageIndex, pageSize])

  useEffect(() => {
    const timeout = window.setTimeout(loadGroups, 0)
    return () => window.clearTimeout(timeout)
  }, [loadGroups])

  const copyResourceName = useCallback(
    async (group: Group) => {
      await navigator.clipboard.writeText(groupResourceName(group))
      toast.success(copy.copied)
    },
    [copy.copied]
  )

  async function confirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await deleteGroup(removeTarget.id)
      setData((current) => ({
        totalCount: Math.max(0, current.totalCount - 1),
        items: current.items.filter((item) => item.id !== removeTarget.id),
      }))
      toast.success(copy.operationSucceeded)
      setRemoveTarget(null)
    } catch {
      toast.error(copy.operationFailed)
    } finally {
      setRemoving(false)
    }
  }

  const columns = useMemo<ColumnDef<Group>[]>(
    () => [
      {
        accessorKey: "name",
        header: copy.name,
        size: 390,
        cell: ({ row }) => {
          const resourceName = groupResourceName(row.original)
          return (
            <div className="min-w-0 space-y-1">
              <Link
                to={localizedPath(
                  lang,
                  `/iam/groups/${encodeURIComponent(row.original.id)}/team`
                )}
                className="block truncate font-semibold text-foreground hover:underline"
              >
                {row.original.name}
              </Link>
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-label={copy.copyResourceName}
                        onClick={() => copyResourceName(row.original)}
                      />
                    }
                  >
                    <Copy className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>{copy.copyResourceName}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="block min-w-0 truncate font-mono text-[0.72rem]" />
                    }
                  >
                    {resourceName}
                  </TooltipTrigger>
                  <TooltipContent>{resourceName}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "description",
        header: copy.description,
        size: 610,
        cell: ({ row }) => (
          <span className="block truncate text-muted-foreground">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: copy.actions,
        size: 220,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Link
              to={localizedPath(
                lang,
                `/iam/groups/${encodeURIComponent(row.original.id)}/team`
              )}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "font-medium"
              )}
            >
              {copy.details}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={() => setRemoveTarget(row.original)}
            >
              {copy.remove}
            </Button>
          </div>
        ),
      },
    ],
    [copy, copyResourceName, lang]
  )

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <header className="mb-10 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {copy.title}
          </h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="relative w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder={copy.filterByName}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            {copy.addGroup}
          </Button>
        </div>

        {error ? (
          <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {copy.listLoadFailed}
            <Button variant="outline" size="sm" onClick={loadGroups}>
              {copy.retry}
            </Button>
          </div>
        ) : null}

        <GroupDataTable
          data={data.items}
          columns={columns}
          loading={loading}
          emptyMessage={
            debouncedSearch ? copy.noGroupResults : copy.emptyGroups
          }
          emptyAction={
            debouncedSearch
              ? { label: copy.clearSearch, onClick: () => setSearch("") }
              : { label: copy.addGroup, onClick: () => setAddOpen(true) }
          }
          minWidth={920}
        />

        <GroupPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={data.totalCount}
          summary={(first, last, total) =>
            copy.showing(first, last, total, copy.groups.toLowerCase())
          }
          perPage={copy.perPage}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />

        {addOpen ? (
          <AddGroupSheet
            open={addOpen}
            copy={copy}
            onOpenChange={setAddOpen}
            onAdded={() => {
              setAddOpen(false)
              loadGroups()
            }}
          />
        ) : null}

        <RemoveDialog
          open={Boolean(removeTarget)}
          title={copy.removeGroupTitle}
          description={
            removeTarget ? (
              <>
                {copy.removeGroupDescriptionBefore}
                <strong className="font-semibold text-foreground">
                  {removeTarget.name}
                </strong>
                {copy.removeGroupDescriptionAfter}
              </>
            ) : null
          }
          cancelLabel={copy.cancel}
          confirmLabel={copy.remove}
          savingLabel={copy.removing}
          saving={removing}
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null)
          }}
          onConfirm={confirmRemove}
        />
      </div>
    </TooltipProvider>
  )
}
