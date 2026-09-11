import { Plus, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TooltipProvider } from "@/components/ui/tooltip"
import { resolveLang } from "@/features/layout/layout-context"
import {
  deletePolicy,
  fetchPolicies,
  policyResourceName,
  type Policy,
} from "../policy-api"
import { AddPolicySheet } from "./components/add-policy-sheet"
import { createPolicyColumns } from "./components/policy-columns"
import { PolicyDataTable } from "./components/policy-data-table"
import { PolicyPagination } from "./components/policy-pagination"
import { RemovePolicyDialog } from "./components/remove-policy-dialog"

export function PolicyPage() {
  const params = useParams()
  const lang = resolveLang(params.lang)
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<{ totalCount: number; items: Policy[] }>({
    totalCount: 0,
    items: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Policy | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (search === debouncedSearch) return

    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search, debouncedSearch])

  const loadPolicies = useCallback(() => {
    setLoading(true)
    setError(false)
    fetchPolicies({
      name: debouncedSearch,
      pageIndex: pageIndex - 1,
      pageSize,
    })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [debouncedSearch, pageIndex, pageSize])

  useEffect(() => {
    const timeout = window.setTimeout(loadPolicies, 0)
    return () => window.clearTimeout(timeout)
  }, [loadPolicies])

  const copyResourceName = useCallback(
    async (policy: Policy) => {
      await navigator.clipboard.writeText(policyResourceName(policy))
      toast.success(t("iam.policies.copied"))
    },
    [t]
  )

  async function confirmRemove() {
    if (!removeTarget || removeTarget.type === "SysManaged") return
    setRemoving(true)
    try {
      await deletePolicy(removeTarget.id)
      setData((current) => ({
        totalCount: Math.max(0, current.totalCount - 1),
        items: current.items.filter((item) => item.id !== removeTarget.id),
      }))
      toast.success(t("iam.policies.operationSucceeded"))
      setRemoveTarget(null)
    } catch {
      toast.error(t("iam.policies.operationFailed"))
    } finally {
      setRemoving(false)
    }
  }

  const columns = useMemo(
    () =>
      createPolicyColumns({
        t,
        lang,
        onCopyResource: (policy) => void copyResourceName(policy),
        onRemove: setRemoveTarget,
      }),
    [copyResourceName, lang, t]
  )

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <header className="mb-10 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("iam.policies.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("iam.policies.subtitle")}
          </p>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="relative w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder={t("iam.policies.filterByName")}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            {t("iam.policies.addPolicy")}
          </Button>
        </div>

        {error ? (
          <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {t("iam.policies.listLoadFailed")}
            <Button variant="outline" size="sm" onClick={loadPolicies}>
              {t("iam.policies.retry")}
            </Button>
          </div>
        ) : null}

        <PolicyDataTable
          data={data.items}
          columns={columns}
          loading={loading}
          emptyMessage={
            debouncedSearch
              ? t("iam.policies.noPolicyResults")
              : t("iam.policies.emptyPolicies")
          }
          emptyAction={
            debouncedSearch
              ? {
                  label: t("iam.policies.clearSearch"),
                  onClick: () => setSearch(""),
                }
              : {
                  label: t("iam.policies.addPolicy"),
                  onClick: () => setAddOpen(true),
                }
          }
        />

        <PolicyPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={data.totalCount}
          summary={(first, last, total) =>
            t("iam.policies.showing", { first, last, total })
          }
          perPage={(count) => t("iam.policies.perPage", { count })}
          previousLabel={t("iam.policies.previousPage")}
          nextLabel={t("iam.policies.nextPage")}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />

        {addOpen ? (
          <AddPolicySheet
            open={addOpen}
            onOpenChange={setAddOpen}
            onAdded={() => {
              setAddOpen(false)
              loadPolicies()
            }}
          />
        ) : null}

        <RemovePolicyDialog
          policy={removeTarget}
          saving={removing}
          title={t("iam.policies.removePolicyTitle")}
          descriptionBefore={t("iam.policies.removePolicyDescriptionBefore")}
          descriptionAfter={t("iam.policies.removePolicyDescriptionAfter")}
          cancelLabel={t("iam.policies.cancel")}
          confirmLabel={t("iam.policies.remove")}
          savingLabel={t("iam.policies.removing")}
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null)
          }}
          onConfirm={confirmRemove}
        />
      </div>
    </TooltipProvider>
  )
}
