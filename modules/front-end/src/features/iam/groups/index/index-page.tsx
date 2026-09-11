import { Plus, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TooltipProvider } from "@/components/ui/tooltip"
import { resolveLang } from "@/features/layout/layout-context"
import { GroupDataTable } from "../components/data-table"
import { GroupPagination } from "../components/pagination"
import { RemoveDialog } from "../components/remove-dialog"
import { AddGroupSheet } from "./components/add-group-sheet"
import { createGroupColumns } from "./components/group-columns"
import {
  deleteGroup,
  fetchGroups,
  groupResourceName,
  type Group,
} from "../group-api"

export function GroupPage() {
  const params = useParams()
  const lang = resolveLang(params.lang)
  const { t } = useTranslation()
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
    if (search === debouncedSearch) return

    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search, debouncedSearch])

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
      toast.success(t("iam.groups.copied"))
    },
    [t]
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
      toast.success(t("iam.groups.operationSucceeded"))
      setRemoveTarget(null)
    } catch {
      toast.error(t("iam.groups.operationFailed"))
    } finally {
      setRemoving(false)
    }
  }

  const columns = useMemo(
    () =>
      createGroupColumns({
        t,
        lang,
        onCopyResource: (group) => void copyResourceName(group),
        onRemove: setRemoveTarget,
      }),
    [copyResourceName, lang, t]
  )

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <header className="mb-10 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("iam.groups.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("iam.groups.subtitle")}
          </p>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="relative w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder={t("iam.groups.filterByName")}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            {t("iam.groups.addGroup")}
          </Button>
        </div>

        {error ? (
          <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {t("iam.groups.listLoadFailed")}
            <Button variant="outline" size="sm" onClick={loadGroups}>
              {t("iam.groups.retry")}
            </Button>
          </div>
        ) : null}

        <GroupDataTable
          data={data.items}
          columns={columns}
          loading={loading}
          emptyMessage={
            debouncedSearch
              ? t("iam.groups.noGroupResults")
              : t("iam.groups.emptyGroups")
          }
          emptyAction={
            debouncedSearch
              ? {
                  label: t("iam.groups.clearSearch"),
                  onClick: () => setSearch(""),
                }
              : {
                  label: t("iam.groups.addGroup"),
                  onClick: () => setAddOpen(true),
                }
          }
          minWidth={920}
        />

        <GroupPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={data.totalCount}
          summary={(first, last, total) =>
            t("iam.groups.showing", {
              first,
              last,
              total,
              noun: t("iam.groups.groups").toLowerCase(),
            })
          }
          perPage={(count) => t("iam.groups.perPage", { count })}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />

        {addOpen ? (
          <AddGroupSheet
            open={addOpen}
            onOpenChange={setAddOpen}
            onAdded={() => {
              setAddOpen(false)
              loadGroups()
            }}
          />
        ) : null}

        <RemoveDialog
          open={Boolean(removeTarget)}
          title={t("iam.groups.removeGroupTitle")}
          description={
            removeTarget ? (
              <>
                {t("iam.groups.removeGroupDescriptionBefore")}
                <strong className="font-semibold text-foreground">
                  {removeTarget.name}
                </strong>
                {t("iam.groups.removeGroupDescriptionAfter")}
              </>
            ) : null
          }
          cancelLabel={t("iam.groups.cancel")}
          confirmLabel={t("iam.groups.remove")}
          savingLabel={t("iam.groups.removing")}
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
