import { Check, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ScopeResource } from "../../segments-types"
import { scopeResourceGroups } from "./scope-resource-groups"
import { ScopeResourceIcon } from "./scope-resource-icon"

function isChildOf(child: ScopeResource, parent: ScopeResource) {
  return child.rn !== parent.rn && `${child.rn}:`.startsWith(`${parent.rn}:`)
}

export function ScopePickerDialog({
  open,
  resources,
  selected,
  currentEnvironmentRn,
  loading,
  error,
  onOpenChange,
  onRetry,
  onApply,
}: {
  open: boolean
  resources: ScopeResource[]
  selected: ScopeResource[]
  currentEnvironmentRn: string
  loading: boolean
  error: boolean
  onOpenChange: (open: boolean) => void
  onRetry: () => void
  onApply: (resources: ScopeResource[]) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState<ScopeResource[]>(selected)

  const currentEnvironment = resources.find(
    (resource) => resource.rn === currentEnvironmentRn
  )
  const selectedWithCurrent = useMemo(() => {
    if (!currentEnvironment) return draft
    return draft.some((item) => item.rn === currentEnvironment.rn)
      ? draft
      : [...draft, currentEnvironment]
  }, [currentEnvironment, draft])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return resources.filter((resource) =>
      `${resource.name} ${resource.pathName} ${resource.rn}`
        .toLowerCase()
        .includes(query)
    )
  }, [resources, search])
  const groupedFiltered = useMemo(
    () =>
      scopeResourceGroups
        .map((group) => ({
          ...group,
          items: filtered.filter((resource) => resource.type === group.type),
        }))
        .filter((group) => group.items.length > 0),
    [filtered]
  )

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSearch("")
      setDraft(selected)
    }
    onOpenChange(nextOpen)
  }

  function toggle(resource: ScopeResource) {
    if (resource.rn === currentEnvironmentRn) return

    setDraft((current) => {
      if (current.some((item) => item.rn === resource.rn)) {
        return current.filter((item) => item.rn !== resource.rn)
      }
      return [
        ...current.filter(
          (item) =>
            !isChildOf(item, resource) || item.rn === currentEnvironmentRn
        ),
        resource,
      ]
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("segments.scopes.title")}</DialogTitle>
          <DialogDescription>
            {t("segments.scopes.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="rounded-lg border bg-muted/30 p-3">
            <h3 className="mb-2 text-xs font-medium">
              {t("segments.scopes.selected")} ({selectedWithCurrent.length})
            </h3>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {selectedWithCurrent.map((resource) => {
                const current = resource.rn === currentEnvironmentRn
                return (
                  <Badge
                    key={resource.rn}
                    variant="secondary"
                    className="max-w-full gap-1 font-normal"
                    title={resource.rn}
                  >
                    <ScopeResourceIcon
                      type={resource.type}
                      className="size-3.5"
                    />
                    <span className="truncate">{resource.pathName}</span>
                    {current ? (
                      <span className="text-[0.65rem] text-muted-foreground">
                        {t("segments.create.current")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={t("segments.scopes.remove", {
                          name: resource.pathName,
                        })}
                        onClick={() => toggle(resource)}
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </Badge>
                )
              })}
            </div>
          </section>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              className="pl-9"
              placeholder={t("segments.scopes.search")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <section>
            <h3 className="mb-2 text-sm font-medium">
              {t("segments.scopes.available")}
            </h3>
            <div className="h-80 overflow-y-auto rounded-lg border p-2">
              {loading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("segments.scopes.loadFailed")}
                  </p>
                  <Button type="button" variant="outline" onClick={onRetry}>
                    {t("segments.retry")}
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {t("segments.scopes.empty")}
                </p>
              ) : (
                groupedFiltered.map((group) => (
                  <div key={group.type}>
                    <div className="sticky top-0 z-10 flex items-center gap-2 bg-background px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      <ScopeResourceIcon
                        type={group.type}
                        className="size-3.5"
                      />
                      {t(group.labelKey)}
                    </div>
                    {group.items.map((resource) => {
                      const explicitlySelected = selectedWithCurrent.some(
                        (item) => item.rn === resource.rn
                      )
                      const coveringParent = selectedWithCurrent.find((item) =>
                        isChildOf(resource, item)
                      )
                      const selectedByParent = Boolean(coveringParent)
                      const current = resource.rn === currentEnvironmentRn
                      const checked = explicitlySelected || selectedByParent
                      const disabled = current || selectedByParent
                      return (
                        <button
                          key={resource.rn}
                          type="button"
                          disabled={disabled}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70",
                            checked && "bg-muted/60"
                          )}
                          onClick={() => toggle(resource)}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            tabIndex={-1}
                            className={cn(!disabled && "cursor-pointer")}
                          />
                          <ScopeResourceIcon type={resource.type} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 font-medium">
                              <span className="truncate">{resource.name}</span>
                              {current ? (
                                <Badge
                                  variant="outline"
                                  className="font-normal"
                                >
                                  {t("segments.create.current")}
                                </Badge>
                              ) : null}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {resource.pathName}
                            </span>
                          </span>
                          {coveringParent && !current ? (
                            <span
                              className="max-w-36 shrink-0 truncate text-xs text-muted-foreground"
                              title={t("segments.scopes.includedBy", {
                                name: coveringParent.pathName,
                              })}
                            >
                              {t("segments.scopes.includedBy", {
                                name: coveringParent.name,
                              })}
                            </span>
                          ) : checked ? (
                            <Check className="size-4 shrink-0" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("segments.scopes.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!selectedWithCurrent.length}
            onClick={() => onApply(selectedWithCurrent)}
          >
            {t("segments.scopes.apply", {
              count: selectedWithCurrent.length,
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
